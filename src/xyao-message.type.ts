/**
 * The message from brain(redis) to x.yao will be parsed to XyaoMessage instance
 */
export default interface XyaoMessage {

  /**
   * the message sent to x.yao in Room or Whisper
   */
  env: 'ROOM' | 'WHISPER'

  /**
   * the message sent to who
   */
  receivers: Contact[]

  /**
   * if message is sent in Room, this field should be set
   */
  room: Room | null

  /**
   * message entities
   */
  entities: MessageEntity[]

}


interface Contact {
  id: string
  name: string
}


interface Room {
  id: string
  topic: string           // communication topic,  note: this is "not" redis topic
}


export type MessageEntity = StringEntity | ContactEntity | UrlLinkEntity | FileBoxEntity

export interface StringEntity {
  type: 'STRING'
  payload: string
}

export interface ContactEntity {
  type: 'CONTACT'
  id: string
  name: string
}

export interface UrlLinkEntity {
  type: 'URL_LINK'
  url: string
  title: string
  thumbnailUrl: string
  description: string
}

export interface FileBoxEntity {
  type: 'FILE_BOX'
  fileName: string
  contentB64: string
}
