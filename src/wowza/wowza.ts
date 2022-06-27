import {
  TStreamInfo,
  TPlayerOptions,
  TSocketRecvData,
  TSocketSendData,
  ValueOf,
} from '../../typings/wowza-types';

import { deferred } from '../utils/deferred';

export class Wowza {
  private ws: WebSocket | null = null;
  private pendingCommands = new Map();

  constructor(
    private url: string,
    private streamInfo: TStreamInfo,
    private userData: TPlayerOptions['userData']
  ) {}

  public connect(): Promise<WebSocket> {
    if (this.ws) {
      return Promise.resolve(this.ws);
    }

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      ws.binaryType = 'arraybuffer';

      ws.onopen = (): void => resolve(ws);
      ws.onerror = (): void => reject();
      ws.onclose = (): void => reject();
      ws.onmessage = this.handleSocketData.bind(this);
      this.ws = ws;
    });
  }

  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  public getOffer(): Promise<TSocketRecvData['getOffer']> {
    if (this.streamInfo.secureToken) {
      return this.send<TSocketSendData['getOffer'], TSocketRecvData['getOffer']>({
        direction: 'play',
        command: 'getOffer',
        secureToken: this.streamInfo.secureToken,
      });
    }
    return this.send<TSocketSendData['getOffer'], TSocketRecvData['getOffer']>({
      direction: 'play',
      command: 'getOffer',
    });
  }

  public sendOffer(
    sdp: RTCSessionDescriptionInit
  ): Promise<TSocketRecvData['sendOffer']> {
    return this.send<
      TSocketSendData['sendOffer'],
      TSocketRecvData['sendOffer']
    >({
      direction: 'publish',
      command: 'sendOffer',
      sdp,
    });
  }

  public sendResponse(
    sdp: RTCSessionDescriptionInit
  ): Promise<TSocketRecvData['sendResponse']> {
    return this.send<
      TSocketSendData['sendResponse'],
      TSocketRecvData['sendResponse']
    >({
      direction: 'play',
      command: 'sendResponse',
      sdp,
    });
  }

  public getAvailableStreams(): Promise<
    TSocketRecvData['getAvailableStreams']
  > {
    return this.send<
      TSocketSendData['getAvailableStreams'],
      TSocketRecvData['getAvailableStreams']
    >({
      direction: 'play',
      command: 'getAvailableStreams',
    });
  }

  private async send<
    S extends { command: string },
    R extends ValueOf<TSocketRecvData>
  >(params: S): Promise<R> {
    const ws = this.ws || (await this.connect());

    if (!this.pendingCommands.has(params.command)) {
      this.pendingCommands.set(params.command, deferred<R>());
    }

    ws.send(
      JSON.stringify({
        ...params,
        streamInfo: this.streamInfo,
        userData: this.userData,
      })
    );

    return this.pendingCommands.get(params.command).promise;
  }

  private handleSocketData(event: MessageEvent): void {
    const data = JSON.parse(event.data);

    // repeater stream not ready
    // TODO repeat action after some times ?
    /*if (data.status === 514) {
      return;
    }*/

    if (data.status !== 200) {
      if (this.pendingCommands.has(data.command)) {
        this.pendingCommands.get(data.command).reject(data);
        this.pendingCommands.delete(data.command);
      }
      return;
    }

    // Consume sessionId
    if (data.streamInfo?.sessionId) {
      this.streamInfo.sessionId = data.streamInfo.sessionId;
    }

    // Dispatch response
    if (this.pendingCommands.has(data.command)) {
      this.pendingCommands.get(data.command).resolve(data);
      this.pendingCommands.delete(data.command);
    }
  }
}
