import { Wechaty, log } from 'wechaty';
import { PuppetPadplus } from 'wechaty-puppet-padplus';
import { Xyao } from '../src/mod';
import {
    EventLogger,
    QRCodeTerminal,
} from 'wechaty-plugin-contrib';

log.level("info");

const token = 'your PAD-PLUS token';
const puppet = new PuppetPadplus({ token });

const bot = new Wechaty({
  puppet,
  name : 'x.yao',
})

const xyaoConfig = {
    redis_host: 'localhost',
    redis_port: 6379,
    redis_password: '123456',
    redis_retry_interval: 5000,
    masters: ['watertao'],
    brains_cli: ['m', 'jira']
};


bot.use(
    QRCodeTerminal({small: true}),
    Xyao(xyaoConfig),
    EventLogger(),
)

bot.start()
    .catch(console.error)
