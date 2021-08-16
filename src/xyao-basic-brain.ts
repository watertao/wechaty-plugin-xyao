import {Wechaty} from "wechaty";
import XyaoInstruction from "./xyao-instruction.type";
import XyaoBasicBrainItsmaster from "./xyao-basic-brain-itsmaster";
import XyaoConfig from "./xyao-config.type";
import {XyaoPluginProcessor} from "./xyao-plugin";
import XyaoBasicBrainWhosmaster from "./xyao-basic-brain-whosmaster";

export default class XyaoBrainBasic {

  private processors: {[key: string]: XyaoBrainBasicInstructionProcessor} = {
    'itsmaster': new XyaoBasicBrainItsmaster(),
    'whosmaster': new XyaoBasicBrainWhosmaster(),
  }

  processInstruction = async (plugin: XyaoPluginProcessor, wechaty: Wechaty, xyaoConfig: XyaoConfig, instruction: XyaoInstruction): Promise<void> => {

    // identify command
    const commandPieces = instruction.text.split(/\s+/)
    let command = commandPieces[0]

    // help print
    if (command == 'help') {
      let helpText = ''
      if (commandPieces.length === 1) {
        Object.keys(this.processors).forEach(key => helpText += `${key}    ${this.processors[key].helpTitle}\n`)
      } else {
        const processor = this.processors[commandPieces[1]]
        if (processor) {
          helpText = `${commandPieces[1]}    ${processor.helpTitle}\n${processor.helpDescription}`
        } else {
          helpText = `command [ ${commandPieces[1]} ] cannot be recognized`
        }
      }
      await sendWechatyMessage(wechaty, instruction, helpText)
    } else {
      const processor = this.processors[command]
      if (!processor) {
        await sendWechatyMessage(wechaty, instruction, `command [ ${command} ] cannot be recognized`)
      } else {
        await processor.process(plugin, wechaty, xyaoConfig, instruction)
      }
    }


  }

}


export async function sendWechatyMessage(wechaty: Wechaty, instruction: XyaoInstruction, entity: any) {
  const { env, room, sender } = instruction
  if (env === 'ROOM') {
    const wechatyRoom = wechaty.Room.load(room!.id)
    if (!wechatyRoom) {
      return
    }
    await wechatyRoom.say(`${wechaty.Contact.load(sender.id).name()}:\n${entity}`, )

  } else if (env === 'WHISPER') {
    wechaty.Contact.load(sender.id).say(entity)
  }
}


export interface XyaoBrainBasicInstructionProcessor {

  helpTitle: string
  helpDescription: string

  process: (plugin: XyaoPluginProcessor, wechaty: Wechaty, xyaoConfig: XyaoConfig, instruction: XyaoInstruction) => Promise<void>

}

