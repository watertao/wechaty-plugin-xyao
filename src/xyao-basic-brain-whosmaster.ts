import { Wechaty} from "wechaty";
import XyaoInstruction from "./xyao-instruction.type";
// @ts-ignore
import parser from 'yargs-parser'
import {sendWechatyMessage, XyaoBrainBasicInstructionProcessor} from "./xyao-basic-brain";
import XyaoConfig from "./xyao-config.type";
import {XyaoPluginProcessor} from "./xyao-plugin";


export default class XyaoBasicBrainWhosmaster implements XyaoBrainBasicInstructionProcessor {

  static COMMAND = 'whosmaster'

  public helpTitle = 'show master'
  public helpDescription = `tell who is the master of x.yao`


  process = async (plugin: XyaoPluginProcessor, wechaty: Wechaty, _xyaoConfig: XyaoConfig, instruction: XyaoInstruction): Promise<void> => {

    const master = plugin.getMaster()
    if (master) {
      await sendWechatyMessage(wechaty, instruction, `my master is: ${master.name()}`)
    } else {
      await sendWechatyMessage(wechaty, instruction, `I does not have a master now, you can use command [itsmaster] to set master for me`)
    }

  }

}
