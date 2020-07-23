import {
  Wechaty,
  WechatyPlugin,
  log,
  Message, UrlLink, FileBox, Room
} from 'wechaty';
import { normalizeConfig }  from './normalize-config';
import redis from 'redis';
import indexOf from 'lodash.indexof';
import trim from 'lodash.trim';
import truncate from 'lodash.truncate';


export interface XyaoConfig {

  redis_host: string,
  redis_port: number,
  redis_password?: string,
  redis_channel_sense?: string,
  redis_channel_prefix?: string,
  redis_retry_interval?: number,

  masters: string[],

  brains_cli: string[],
  brains_ai?: string,

  log_msg_length?: number,
  log_msg_show_unrelated?: boolean,

  msg_abandon_age?: number,

}


function Xyao (config: XyaoConfig): WechatyPlugin {
  log.info('x.yao', 'initiate plugin with config: %s', JSON.stringify(config))

  normalizeConfig(config)

  const onRedisReady = (client: string) => {
    return () => log.info('x.yao', `redis(${client}) - connected`);
  };

  const redisRetryStrategy = (client: string) => {
    return (options: any) => {
      log.error('x.yao', `redis(${client}) - error: ${ options.error ? options.error.message : 'connection lost' }`)
      log.info('x.yao', `redis(${client}) - try reconnect to redis after ${config.redis_retry_interval} ms`);
      return config.redis_retry_interval;
    }
  };

  const onRedisError = (client: string) => {
    return  (e: Error) => {
      log.error('x.yao', `redis(${client}) - error: ${ e.message }`);
      process.exit();
    };
  };



  const onReconnecting = (client: string) => {
    return () => log.info('x.yao', `redis(${client}) - reconnecting...`);
  };

  const subscriber = redis.createClient({
    host: config.redis_host,
    port: config.redis_port,
    password: config.redis_password,
    retry_strategy: redisRetryStrategy('sub')
  });

  subscriber.on('subscribe', (channel: string, count: number) => {
    console.log(`[ redis ] subscribe channel: ${ channel }, subscriptions for this client count: %${ count }`)
  });

  subscriber.on('error', onRedisError('sub'));
  subscriber.on('ready', onRedisReady('sub'));
  subscriber.on('reconnecting', onReconnecting('sub'))

  // subscriber.on("message", (channel: string, message: string) => {
  //   // console.log(`[ ^o^ ] [ ${ channel } ] ${ _.truncate(message, {length: config.log.msg_length})}`)
  //   this.onMessage(JSON.parse(message));
  // });

  const publisher = redis.createClient({
    host: config.redis_host,
    port: config.redis_port,
    password: config.redis_password,
    retry_strategy: redisRetryStrategy('pub')
  });
  publisher.on('error', onRedisError('pub'));
  publisher.on('ready', onRedisReady('pub'));
  publisher.on('reconnecting', onReconnecting('pub'))

  return function XyaoPlugin (wechaty: Wechaty) {
    log.verbose('x.yao', 'Xyao(%s)', wechaty)

    const supportedBrain = (text: string) => {
      if (text.indexOf(":") > 0) {
        let brain = text.substring(0, text.indexOf(":" ));
        let command = trim(text.substring(text.indexOf(":") + 1));
        if (indexOf(config.brains_cli, brain) >= 0) {
          return { brain, command};
        }
      }
      return { brain: null, command: ''};
    }

    const makeInstruction = async (message: Message, command: string) => {
      return {
        from: { id: message.from()?.id, name: message.from()?.name() },
        isPrivate: message.to() ? true : false,
        room: message.room() ? { id: message.room()?.id, topic: (await message.room()?.topic()) } : null,
        command,
      };
    }

    const makeQuestion = async (message: Message) => {
      return {
        from: { id: message.from()?.id, name: message.from()?.name() },
        room: message.room() ? { id: message.room()?.id, topic: (await message.room()?.topic()) } : null,
        text: message.text(),
      };
    };

    const onUserLogin = (user: string) => {
      log.info('x.yao', `user successfully logged in : ${ user }`);
    }

    const onError = (e: Error) => { log.error('x.yao', `wechaty error - ${ e.message }`) };

    const chkDirtyMessage = (() => {
      // const freqMap = {};
      return (message: Message): boolean => {
        // const userName = message.from()!.name();
        message.from();
        // todo:

        if (message.age() > config.msg_abandon_age!) {
          return true;
        }
        return false;
      }
    })();

    const onRedisMessage = async (_: string, message: string) => {
      log.info('x.yao', `redis(sub) - ${ message }`)
      const rMessage = JSON.parse(message);
      const { to, room, entities } = rMessage;
      const toContact = await wechaty.Contact.load(to.id);
      if (!toContact) {
        log.warn('x.yao', `user [ ${ to.name } ] cannot be found, abandon this message`);
        return;
      }
      let rRoom: Room | null;
      if (room) {
        rRoom = await wechaty.Room.load(room.id);
        if (!rRoom) {
          log.warn('x.yao', `room [ ${ room.topic } ] cannot be found, abandon this message`);
          return;
        }
      }

      const convertedEntities = [];
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];
        switch (entity.type) {
          case 'STRING':
            convertedEntities.push(entity.payload);
            break;
          case 'FILE_BOX':
            convertedEntities.push(FileBox.fromBase64(entity.content, entity.fileName));
            break;
          case 'CONTACT':
            const contact = await wechaty.Contact.load(entity.id );
            convertedEntities.push(contact);
            break;
          case 'URL_LINK':
            convertedEntities.push(new UrlLink(entity));
            break;
          default:
            convertedEntities.push(JSON.stringify(entity));
        }
      }

      if (!room) {
        convertedEntities.forEach(entity => {
          toContact.say(entity);
        });
      } else {
        convertedEntities.forEach(entity => {
          rRoom!.say(entity, ...[ toContact ]);
        });
      }
    };

    const onWechatyMessage = async (message: Message) => {
      // ignore the messages not related to x.yao
      if (message.room() && !(await message.mentionSelf())) {
        if (config.log_msg_show_unrelated) {
          log.info('x.yao', `[ ... ] ${ truncate(message.text(), { length: config.log_msg_length }) }`)
        }
        return;
      }

      if (chkDirtyMessage(message)) { return; }

      log.info('x.yao', `[ ooo ] ${ truncate(message.text(), { length: config.log_msg_length }) }`)


      // jira:bind-project -p REDKE223
      const text = message.text();
      const { brain, command } = supportedBrain(text);
      if (brain) {
        const channel = config.redis_channel_prefix + brain;
        const instruction = JSON.stringify(await makeInstruction(message, command));
        log.info('x.yao', `[ >>> ] [ ${ channel } ] ${ instruction }`);
        publisher.publish(channel, instruction);
      } else {
        const channel = config.redis_channel_prefix + config.brains_ai!;
        const question = JSON.stringify(await makeQuestion(message));
        log.info('x.yao', `[ ))) ] [ ${ channel } ] ${ question }`);
        publisher.publish(channel, question);
      }
    }

    wechaty.on('login', onUserLogin);
    wechaty.on('error', onError);
    wechaty.on('message', onWechatyMessage);

    subscriber.on('message', onRedisMessage);
    subscriber.subscribe(config.redis_channel_sense!);

  }
}

export { Xyao }
