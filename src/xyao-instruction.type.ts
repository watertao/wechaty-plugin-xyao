/**
 * The message from user to x.yao ,will be parsed to XyaoInstruction object
 */
export default interface XyaoInstruction {

  /**
   * the id of brain
   * e.g.   x / fin / jira
   */
  brain: string

  /**
   * the message sent to x.yao in Room or Whisper
   */
  env: 'ROOM' | 'WHISPER'

  /**
   * who send this instruction
   */
  sender: InstructionSender

  /**
   * if message is sent in Room, this field should be set
   */
  room: Room | null

  /**
   * the message after brain prefix, for example
   * message is 'x:dice 100' , the text will be 'dice 100'
   */
  text: string

}


interface InstructionSender {
  id: string
  name: string
  isMaster: boolean
}


interface Room {
  id: string
  topic: string           // communication topic,  note: this is "not" redis topic
}
