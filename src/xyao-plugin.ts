import {
  Wechaty,
  WechatyPlugin,
  Message, UrlLink, FileBox, Contact,
} from 'wechaty'
import XyaoConfig from './xyao-config.type'
import LoggerFactory from './logger'
import { Logger } from 'log4js'
import redis, {RedisClient} from "redis";
import truncate from "lodash.truncate";
import {generate} from "qrcode-terminal";
import trim from "lodash.trim";
import indexOf from "lodash.indexof";
import XyaoInstruction from "./xyao-instruction.type";
import XyaoMessage, {
  ContactEntity,
  FileBoxEntity,
  MessageEntity,
  StringEntity,
  UrlLinkEntity
} from "./xyao-message.type";
import XyaoBrainBasic from "./xyao-basic-brain";


export default (config: XyaoConfig): WechatyPlugin => {
  return (wechaty: Wechaty): void => {
    const xyaoPluginProcessor = new XyaoPluginProcessor(wechaty, config)
    xyaoPluginProcessor.init()
    xyaoPluginProcessor.startup()
  }
}


export class XyaoPluginProcessor {

  static WECHATY_BOT_KEY = 'x.yao'

  // X: x.yao(bot); R: redis(brain); U: contact
  static MSG_DIR_REDIS_2_XYAO   = 'R->X'
  static MSG_DIR_XYAO_2_REDIS   = 'X->R'
  static MSG_DIR_USER_2_XYAO    = 'U->X'
  static MSG_DIR_XYAO_2_USER    = 'X->U'

  private readonly logger: Logger
  private readonly xyaoConfig: XyaoConfig
  private readonly wechaty: Wechaty

  private readonly basicBrain = new XyaoBrainBasic()

  /**
   * r -> x
   * x.yao use this redis client to receive message from brains
   */
  private subscriber: RedisClient | undefined

  /**
   * x -> y
   * x.yao use this redis client to send message(or instruction) to brains
   */
  private publisher: RedisClient | undefined

  /**
   * x.yao ( contact )
   * will be set when login
   */
  private xyaoContact: Contact | undefined

  /**
   * the master of x.yao ( contact )
   * will be set when instruction 'xyao918:itsmaster 123456' was send
   */
  private masterContact: Contact | undefined

  constructor(wechaty: Wechaty, xyaoConfig: XyaoConfig) {
    this.logger = LoggerFactory.getLogger(XyaoPluginProcessor.WECHATY_BOT_KEY, xyaoConfig)
    this.wechaty = wechaty
    this.xyaoConfig = xyaoConfig
  }

  /**
   * initialize wechaty / subscriber / publisher, register event listeners
   * but not register message listener for wechaty or subscriber, this 2 listener will be register in startup()
   */
  init = (): void => {
    this.initWechaty()
    this.initRedisSubscriber()
    this.initRedisPublisher()
  }


  /**
   * start to listen wechaty message and brain messages
   * Note: this should be called after initialization
   */
  startup = () => {
    const { redis_channel_sense } = this.xyaoConfig

    // listen wechaty message
    this.wechaty.on('message', this._onWechatyMessage)

    // listen brain(redis) message
    this.subscriber!.subscribe(redis_channel_sense)
  }


  initWechaty = () => {
    this.wechaty.on('scan', this._onWechatyScan)        // when wechaty need user to scan
    this.wechaty.on('login', this._onWechatyLogin)
    this.wechaty.on('error', this._onWechatyError)
    this.wechaty.on('logout', this._onWechatyLogout)
  }


  initRedisSubscriber = () => {

    const { redis_host, redis_port, redis_password } = this.xyaoConfig
    const clientKey = XyaoPluginProcessor.MSG_DIR_REDIS_2_XYAO

    const subscriber = redis.createClient({
      host: redis_host,
      port: redis_port,
      password: redis_password,
      retry_strategy: this._redisRetryStrategy(clientKey)
    })

    subscriber.on('subscribe', (channel: string, count: number) => {
      this.logger.info(`[ redis ] subscribe channel: ${ channel }, subscriptions for this client count: ${ count }`)
    })

    subscriber.on('error', this._onRedisError(clientKey))
    subscriber.on('ready', this._onRedisReady(clientKey))
    subscriber.on('reconnecting', this._onReconnecting(clientKey))
    subscriber.on('message', this._onRedisMessage);

    this.subscriber = subscriber

  }


  initRedisPublisher = () => {

    const { redis_host, redis_port, redis_password } = this.xyaoConfig
    const clientKey = XyaoPluginProcessor.MSG_DIR_XYAO_2_REDIS

    const publisher = redis.createClient({
      host: redis_host,
      port: redis_port,
      password: redis_password,
      retry_strategy: this._redisRetryStrategy(clientKey)
    });
    publisher.on('error', this._onRedisError(clientKey));
    publisher.on('ready', this._onRedisReady(clientKey));
    publisher.on('reconnecting', this._onReconnecting(clientKey))

    this.publisher = publisher

  }


  setMaster = (master: Contact) => {
    this.masterContact = master
  }

  getMaster = () => {
    return this.masterContact
  }


  _onWechatyMessage = async (message: Message) => {

    const { log_msg_show_unrelated, redis_channel_prefix, brain_basic } = this.xyaoConfig

    // ignore dirty messages such as:
    // blank messages
    // expired messages and etc.
    // message from x.yao self
    // not text messages, such as image
    if (this._chkDirtyMessage(message)) {
      this.logger.info(`[ ${ XyaoPluginProcessor.MSG_DIR_USER_2_XYAO } ] [ dirty ] ${ this._trunc(message.text()) }`)
      return
    }

    // ignore the messages not related to x.yao
    // - whisper messages will be treated as related messages
    // - room messages with 2 situations below will be treated as unrelated message:
    //   1. the message is not mention x.yao
    //   2. the mention list is more than 1 users (means messages are not target to x.yao)
    if (message.room() && !this._isMentionSelfOnly(message)) {
      if (log_msg_show_unrelated) {
        this.logger.info(`[ ${ XyaoPluginProcessor.MSG_DIR_USER_2_XYAO } ] [ unrel ] ${ this._trunc(message.text()) }`)
      }
      return
    }


    this.logger.info(`[ ${ XyaoPluginProcessor.MSG_DIR_USER_2_XYAO } ] ${ this._trunc(message.text()) }`)


    // identify instruction and send to corresponding brain endpoint via redis
    const instruction = await this._identifyXyaoInstruction(message)

    // if instruction text is blank, nothing will be happened
    if (!instruction.text) return

    if (instruction.brain === brain_basic) {
      // basic instruction process locally
      this._processBasicInstruction(instruction)
    } else {
      // other instruction process remotely
      const instructionJSON = JSON.stringify(instruction)
      const { brain } = instruction
      const channel = `${redis_channel_prefix}${brain}`
      this.logger.info(`[ ${XyaoPluginProcessor.MSG_DIR_XYAO_2_REDIS} ] [ ${ channel } ] ${ instructionJSON }`);
      this.publisher!.publish(channel, instructionJSON);
    }
  }


  /**
   * when redis subscriber received message from brain endpoint, messages will be processed by this method.
   *
   * @param _
   * @param message
   * @private
   */
  _onRedisMessage = async (_: string, message: string) => {

    this.logger.info(`[ ${XyaoPluginProcessor.MSG_DIR_REDIS_2_XYAO} ] - ${ this._trunc(message) }`)

    const xyaoMessage = JSON.parse(message) as XyaoMessage;
    const { env, receivers, room, entities } = xyaoMessage;

    const wechatyReceiverContacts: Contact[] = []
    for (let i = 0; i < receivers.length; i++) {
      wechatyReceiverContacts.push(await this.wechaty.Contact.load(receivers[i].id))
    }

    const wechatyEntities: any[] = []
    for (let i = 0; i < entities.length; i++) {
      wechatyEntities.push(await this._convertToWechatyEntity(entities[i]))
    }

    if (env === 'ROOM') {

      if (!room) {
        this.logger.error('a xyao message should have field [ room ] when its env is ROOM')
        return
      }
      const wechatyRoom = this.wechaty.Room.load(room.id)
      if (!wechatyRoom) {
        this.logger.error(`room [ ${room.topic} ] could not be found via id`)
        return
      }
      wechatyEntities.forEach(entity => wechatyRoom.say(entity, ...wechatyReceiverContacts))

    } else if (env === 'WHISPER') {

      if (wechatyReceiverContacts.length <= 0) {
        this.logger.error('at least 1 receiver should be in xyao message')
        return
      }
      wechatyReceiverContacts.forEach(contact => {
        wechatyEntities.forEach(entity => contact.say(entity))
      })

    }

  }

  _onWechatyError = (err: Error) => {
    this.logger.error(`wechaty error - ${ err.message }`)
  }

  _onWechatyLogin = (user: Contact) => {
    this.logger.info(`login successfully : ${ user.name() } ( ${ user.id } )`);
    this.xyaoContact = user;
  }

  _onWechatyScan = (qrcode: string) => {
    generate(qrcode, {small: true,}, (graph: string) =>{
      // add "\n" for fixing misplacement of first line in QR Code
      this.logger.info("\n" + graph);
    })
  }

  _onWechatyLogout = () => {
    this.logger.info('bot has been logged out')
    process.exit(0)
  }


  _onRedisReady = (client: string) => {
    return () => this.logger.info(`redis(${client}) - connected`);
  }

  _redisRetryStrategy = (client: string) => {
    const { redis_retry_interval } = this.xyaoConfig
    return (options: any) => {
      this.logger.error(`redis(${client}) - error: ${ options.error ? options.error.message : 'connection lost' }`)
      this.logger.info(`redis(${client}) - try reconnect to redis after ${redis_retry_interval} ms`);
      return redis_retry_interval;
    }
  }

  _onRedisError = (client: string) => {
    return  (e: Error) => {
      this.logger.error(`redis(${client}) - error: ${ e.message }`);
      process.exit();
    };
  };

  _onReconnecting = (client: string) => {
    return () => this.logger.info(`redis(${client}) - reconnecting...`);
  };

  _trunc = (message: string) => {
    const { log_msg_length } = this.xyaoConfig
    if (log_msg_length <= 0) {
      return message
    } else {
      return truncate(message, { length: log_msg_length })
    }
  }


  /**
   * Check whether message is blank or expired or sent by x.yao self
   *
   * @param message
   * @private
   */
  _chkDirtyMessage = (message: Message): boolean => {

    const { msg_abandon_age } = this.xyaoConfig

    // blank messages
    if (!trim(message.text())) {
      return true
    }

    // expired message
    if (message.age() > msg_abandon_age!) {
      return true
    }

    // sent by x.yao self
    if (message.talker().id === this.xyaoContact!.id) {
      return true
    }

    // not text messages
    if (message.type() !== 7) {
      return true
    }

    return false

  }


  /**
   * identify instructions from wechat message.
   *
   * @param message
   * @private
   */
  _identifyXyaoInstruction = async (message: Message): Promise<XyaoInstruction> => {

    const { brains_cli, brains_ai, brain_basic } = this.xyaoConfig

    let processedText = null

    // messages in room has '@x.yao', this should be filtered
    // for example: '@x.yao x:dice 100' will be processed to 'x:dice 100'
    // messages on whisper do not need to process
    if (message.room()) {
      processedText = this._preprocessMention(message.text())
        .replace(`@${this.xyaoContact!.name()}`, '')
        .replace(`@${this.xyaoContact!.id}`, '')
        .trim();
    } else {
      processedText = message.text().trim();
    }

    // identify brain
    // if cannot , return null
    let brain = null
    let instruction = null
    if (processedText.indexOf(":") > 0) {
      const potentialBrain = processedText.substring(0, processedText.indexOf(":" ));
      instruction = trim(processedText.substring(processedText.indexOf(":") + 1));
      if (indexOf(brains_cli, potentialBrain) >= 0) {
        brain = potentialBrain
      } else if (potentialBrain === brain_basic) {
        brain = potentialBrain
      }
    }
    if (!brain) {
      brain = brains_ai
      instruction = processedText
    }


    // make instruction object
    return {
      env: message.room() ? 'ROOM' : 'WHISPER',
      brain,
      sender: {
        id: message.talker().id,
        name: message.talker().name(),
        isMaster: this.masterContact ? (this.masterContact.id === message.talker().id) : false
      },
      room: message.room() ? { id: message.room()!.id, topic: await (message.room()!.topic()) } : null,
      text: instruction!
    }

  }


  _convertToWechatyEntity = async (entity: MessageEntity): Promise<String | FileBox | Contact | UrlLink> => {

    const { type } = entity
    if (type === 'STRING') {
      const cEntity = (entity as StringEntity)
      return cEntity.payload
    } else if (type === 'FILE_BOX') {
      const cEntity = (entity as FileBoxEntity)
      return FileBox.fromBase64(cEntity.contentB64, cEntity.fileName)
    } else if (type === 'CONTACT') {
      const cEntity = (entity as ContactEntity)
      return this.wechaty.Contact.load(cEntity.id )
    } else if (type === 'URL_LINK') {
      const cEntity = (entity as UrlLinkEntity)
      return new UrlLink(cEntity)
    } else {
      throw new Error(`entity type [ ${type} ] cannot be recognized`)
    }

  }


  /**
   * in wechaty-puppet-wechat:0.28.4 , the method mentionSelf() / mentionList() of wechaty instance does not work.
   * message example:
   * <a target="_blank" href="/cgi-bin/mmwebwx-bin/webwxcheckurl?requrl=http%3A%2F%2F%40x.yao&skey=%40crypt_91c8b
   * b5_01b599980d9101a6aad17b0fbd07f863&deviceid=e969752896787762&pass_ticket=BexnbApfREMD5VbIxq%252FdLuwUhvEGXa
   * x7yDOftCuzfCnrvj5Gu8eYzX8St0TGlhXa&opcode=2&scene=1&username=@6877358300792877a28e1f127089fc37311588fd34e870
   * 5725f46ce988d26f30">@x.yao</a> @another test
   *
   * parse message above and get mention list
   *
   * @param message
   * @private
   */
  _isMentionSelfOnly = (message: Message): boolean => {

    if (message.type() !== 7) {
      return false
    }

    // make "<a target...> @x.yao</a>"  to  " @x.yao "
    const processedText = this._preprocessMention(message.text())

    // message should start with @x.yao
    if (!processedText.startsWith(`@${XyaoPluginProcessor.WECHATY_BOT_KEY} `)) {
      return false
    }

    // it should be only 1 mention
    if (processedText.split(/\s+/)[1].startsWith('@')) {
      return false
    }

    return true

  }


  /**
   * in wechaty-puppet-wechat:0.28.4 , the method mentionSelf() / mentionList() of wechaty instance does not work.
   * message example:
   * <a target="_blank" href="/cgi-bin/mmwebwx-bin/webwxcheckurl?requrl=http%3A%2F%2F%40x.yao&skey=%40crypt_91c8b
   * b5_01b599980d9101a6aad17b0fbd07f863&deviceid=e969752896787762&pass_ticket=BexnbApfREMD5VbIxq%252FdLuwUhvEGXa
   * x7yDOftCuzfCnrvj5Gu8eYzX8St0TGlhXa&opcode=2&scene=1&username=@6877358300792877a28e1f127089fc37311588fd34e870
   * 5725f46ce988d26f30">@x.yao</a> @another test
   *
   * this method will process text above to:
   *       @x.yao @another test
   *
   * @param text
   * @private
   */
  _preprocessMention = (text: string): string => {
    return text.replace(/\<a target.+>\s*@x\.yao\s*<\/a>/, ' @x.yao ').trim()
  }


  _processBasicInstruction = async (instruction: XyaoInstruction) => {
    await this.basicBrain.processInstruction(this, this.wechaty, this.xyaoConfig, instruction)
  }

}
