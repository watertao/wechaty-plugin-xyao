import { XyaoConfig } from './plugin';
import indexOf from 'lodash.indexof';

function normalizeConfig (config: XyaoConfig) {

  const AVAILABLE_LOG_LEVELS = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
  const AVAILABLE_LOG_APPENDERS = ['stdout', 'dateFile'];

  const DEFAULT_REDIS_CHANNEL_SENSE = 'x.yao';
  const DEFAULT_REDIS_CHANNEL_PREFIX = 'x.yao.';
  const DEFAULT_RETRY_INTERVAL = 60000;
  const DEFAULT_BRAINS_AI = 'ai918';
  const DEFAULT_LOG_MSG_LENGTH = 23;
  const DEFAULT_MSG_ABANDON_AGE = 10;
  const DEFAULT_LOG_MSG_SHOW_UNRELATED = false;
  const DEFAULT_LOG_LEVEL = 'INFO';
  const DEFAULT_LOG_APPENDER = 'stdout';

  config.redis_channel_sense = config.redis_channel_sense || DEFAULT_REDIS_CHANNEL_SENSE;
  config.redis_channel_prefix = config.redis_channel_prefix || DEFAULT_REDIS_CHANNEL_PREFIX;
  config.redis_retry_interval = config.redis_retry_interval || DEFAULT_RETRY_INTERVAL;
  config.brains_ai = config.brains_ai || DEFAULT_BRAINS_AI;
  config.log_msg_length = config.log_msg_length || DEFAULT_LOG_MSG_LENGTH;
  config.msg_abandon_age = config.msg_abandon_age || DEFAULT_MSG_ABANDON_AGE;
  config.log_msg_show_unrelated = config.log_msg_show_unrelated || DEFAULT_LOG_MSG_SHOW_UNRELATED;
  config.log_level = config.log_level || DEFAULT_LOG_LEVEL;
  config.log_appender = config.log_appender || DEFAULT_LOG_APPENDER;

  if (indexOf(AVAILABLE_LOG_LEVELS, config.log_level.toUpperCase()) < 0) {
    throw new Error(`
      Plugin config log_level should be one of ${ AVAILABLE_LOG_LEVELS.join(',') }.
    `)
  }

  if (indexOf(AVAILABLE_LOG_APPENDERS, config.log_appender) < 0) {
    throw new Error(`
      Plugin config log_appender should be one of ${ AVAILABLE_LOG_APPENDERS.join(',') }.
    `)
  }

  if (config.log_appender === 'dateFile' && !config.log_file) {
    throw new Error(`
      Plugin config log_file should be specified while using dateFile log appender}.
    `)
  }

  if (!config.masters || config.masters.length < 1) {
    throw new Error(`
      Wechaty Xyao Plugin requires at lease 1 master.
      Please set 'masters' in plugin config.
    `)
  }

  if (!config.brains_cli || config.brains_cli.length < 1) {
    throw new Error(`
      Wechaty Xyao Plugin requires at lease 1 cli brain.
      Please set 'brains_cli' in plugin config.
    `)
  }

}

export { normalizeConfig }
