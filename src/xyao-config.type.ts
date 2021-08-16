
export default interface XyaoConfig {

  // redis configuration
  redis_host: string,             // redis host
  redis_port: number,             // port
  redis_password?: string,        // password if required
  redis_retry_interval: number,   // interval for trying to reconnect to redis server
  redis_channel_sense: string,    // topic which x.yao read message
  redis_channel_prefix: string,   // prefix of brain topic which x.yao send messages to

  /**
   * some instructions could only be send by master,
   * use this config item to tell x.yao who is master
   * use instruction 'xyao918:itsmaster 123456' to set who is master
   */
  masterPassword: string,

  /**
   * the instruction prefix for controlling xyao by master
   */
  brain_basic: 'xyao918',

  /**
   * we could have multiple brains behind x.yao, each brain will process instruction with specified prefix, for example:
   * 'abc:dice' ,  the 'abc' is the prefix of instruction.
   * when x.yao received a message (e.g. 'abc:dice'), it will send this message to redis topic: 'x.yao.abc', 'x.yao' is
   * defined in config 'redis_channel_prefix'
   *
   * example:
   * [ 'x', 'fin', 'jira' ]
   */
  brains_cli: string[],

  /**
   * the messages that could not be identified as an instruction will be send to this brain.
   * the brain will request to outside API for communication AI, such as Baidu, Tencent
   */
  brains_ai: string,

  // log configuration
  log_level: LogLevel;                // the logs higher or equal than this level will be printed
  log_appender: LogAppender,          // where the logs will be print, file or standard output (console)
  log_file?: string,                  // when appender was 'dateFile', we should set the file location and name
  log_msg_length: number,             // the message we received by x.yao may be large, it will be trimmed before print
  log_msg_show_unrelated: boolean,    // messages in room are always not send to x.yao, whether to print it

  /**
   * messages in room are always not send to x.yao,
   * use this config to setting whether these messages should be print or not
   */
  msg_abandon_age: number,

}

type LogLevel = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL'
type LogAppender = 'stdout' | 'dateFile'

export const normalizeConfig = (config: any): XyaoConfig => {

  const DEFAULT_REDIS_HOST = '127.0.0.1'
  const DEFAULT_REDIS_PORT = 6379
  const DEFAULT_REDIS_CHANNEL_SENSE = 'x.yao';
  const DEFAULT_REDIS_CHANNEL_PREFIX = 'x.yao.';
  const DEFAULT_REDIS_RECONNECT_INTERVAL = 60000;
  const DEFAULT_BRAINS_AI = 'ai918';
  const DEFAULT_LOG_MSG_LENGTH = 87;
  const DEFAULT_MSG_ABANDON_AGE = 30000;
  const DEFAULT_LOG_MSG_SHOW_UNRELATED = true;
  const DEFAULT_LOG_LEVEL = 'INFO';
  const DEFAULT_LOG_APPENDER = 'stdout';
  const DEFAULT_MASTER_PASSWORD = '12345678'
  const DEFAULT_BRAIN_BASIC = 'xyao918'

  const xyaoConfig = {
    redis_host: config.redis_host || DEFAULT_REDIS_HOST,
    redis_port: config.redis_port || DEFAULT_REDIS_PORT,
    redis_password: config.redis_password,
    redis_channel_sense: config.redis_channel_sense || DEFAULT_REDIS_CHANNEL_SENSE,
    redis_channel_prefix: config.redis_channel_prefix || DEFAULT_REDIS_CHANNEL_PREFIX,
    redis_retry_interval: config.redis_retry_interval || DEFAULT_REDIS_RECONNECT_INTERVAL,

    masterPassword: config.masterPassword || DEFAULT_MASTER_PASSWORD,

    brains_cli: config.brains_cli || [],
    brains_ai : config.brains_ai || DEFAULT_BRAINS_AI,
    brain_basic: config.brain_basic || DEFAULT_BRAIN_BASIC,

    log_msg_length: config.log_msg_length || DEFAULT_LOG_MSG_LENGTH,
    log_msg_show_unrelated: config.log_msg_show_unrelated || DEFAULT_LOG_MSG_SHOW_UNRELATED,
    log_level: config.log_level || DEFAULT_LOG_LEVEL,
    log_appender: config.log_appender || DEFAULT_LOG_APPENDER,
    log_file: config.log_file,
    msg_abandon_age: config.msg_abandon_age || DEFAULT_MSG_ABANDON_AGE,


  } as XyaoConfig



  if (config.log_appender === 'dateFile' && !config.log_file) {
    throw new Error(`
      Plugin config [ log_file ] should be specified while using dateFile log appender.
    `)
  }

  if (!config.brains_cli || config.brains_cli.length < 1) {
    throw new Error(`
      Wechaty Xyao Plugin requires at lease 1 cli brain.
      Please set 'brains_cli' in plugin config.
    `)
  }

  return xyaoConfig

}

