import { Wechaty } from 'wechaty';
import { PuppetPadplus } from 'wechaty-puppet-padplus';
import { Xyao } from '../src/mod';


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
  masters: ['wxid_of_master'],
  brains_cli: ['x', 'jira'],
  brains_ai: 'ai918',
  log_appender: 'stdout',
  log_file: '/data/wechaty-xyao/xyao.log',
  log_level: 'INFO'
};


bot.use(
    Xyao(xyaoConfig),
)

bot.start()
    .catch(console.error)
