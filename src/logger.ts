import log4js, { Logger } from 'log4js'
import XyaoConfig from './xyao-config.type'

export default class LoggerFactory {

  static getLogger = (loggerName: string, xyaoConfig: XyaoConfig): Logger => {

    const { log_file, log_appender, log_level } = xyaoConfig

    log4js.configure({
      appenders: {
        stdout: { type: 'stdout' },
        dateFile: { type: 'dateFile', filename: log_file, pattern: '.yyyy-MM-dd' }
      },
      categories: {
        [loggerName]: { appenders: [ log_appender ], level: log_level},
        default: { appenders: [ 'stdout' ], level: 'INFO'}
      }
    })

    return log4js.getLogger(loggerName);

  }

}
