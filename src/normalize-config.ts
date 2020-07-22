import { XyaoConfig } from './plugin';

function normalizeConfig (config: XyaoConfig) {

  const DEFAULT_REDIS_CHANNEL_SENSE = 'x.yao';
  const DEFAULT_REDIS_CHANNEL_PREFIX = 'x.yao.';
  const DEFAULT_RETRY_INTERVAL = 60000;
  const DEFAULT_BRAINS_AI = 'ai918';
  const DEFAULT_LOG_MSG_LENGTH = 23;
  const DEFAULT_MSG_ABANDON_AGE = 10;
  const DEFAULT_LOG_MSG_SHOW_UNRELATED = false;

  config.redis_channel_sense = config.redis_channel_sense || DEFAULT_REDIS_CHANNEL_SENSE;
  config.redis_channel_prefix = config.redis_channel_prefix || DEFAULT_REDIS_CHANNEL_PREFIX;
  config.redis_retry_interval = config.redis_retry_interval || DEFAULT_RETRY_INTERVAL;
  config.brains_ai = config.brains_ai || DEFAULT_BRAINS_AI;
  config.log_msg_length = config.log_msg_length || DEFAULT_LOG_MSG_LENGTH;
  config.msg_abandon_age = config.msg_abandon_age || DEFAULT_MSG_ABANDON_AGE;
  config.log_msg_show_unrelated = config.log_msg_show_unrelated || DEFAULT_LOG_MSG_SHOW_UNRELATED;

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
