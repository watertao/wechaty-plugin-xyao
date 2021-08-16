import {Wechaty} from "wechaty";
import XyaoInstruction from "./xyao-instruction.type";
// @ts-ignore
import parser from 'yargs-parser'
import {sendWechatyMessage, XyaoBrainBasicInstructionProcessor} from "./xyao-basic-brain";
import XyaoConfig from "./xyao-config.type";
import {XyaoPluginProcessor} from "./xyao-plugin";


export default class XyaoBasicBrainItsmaster implements XyaoBrainBasicInstructionProcessor {

  static COMMAND = 'itsmaster'

  public helpTitle = 'setting master'
  public helpDescription = `-p <password> : password for identify`


  process = async (plugin: XyaoPluginProcessor, wechaty: Wechaty, xyaoConfig: XyaoConfig, instruction: XyaoInstruction): Promise<void> => {

    // this instruction could only be given in whisper
    if (instruction.env !== 'WHISPER') {
      await sendWechatyMessage(wechaty, instruction, 'instruction [ itsmaster ] should be given on whisper')
      return
    }

    const args = parser(instruction.text.substring(XyaoBasicBrainItsmaster.COMMAND.length).trim())
    if (!args['p']) {
      await sendWechatyMessage(wechaty, instruction, 'option [ -p ] required')
      return
    }

    if (args['p'] == xyaoConfig.masterPassword) {
      const { sender } = instruction
      plugin.setMaster(wechaty.Contact.load(sender.id))
      await sendWechatyMessage(wechaty, instruction, `hi ${sender.name}, you're my master now !`)
    } else {
      await sendWechatyMessage(wechaty, instruction, `wrong password`)
    }

  }

}
