export type ValueOf<T> = T[keyof T];
export type PartialObject<T> = { [P in keyof T]?: T[P] };

export interface TPlayerOptions {
  sdpUrl?: string;
  applicationName?: string;
  streamName?: string;
  videoConfigs?: TVideoConfigs;
  audioConfigs?: TAudioConfigs;
  constraints?: MediaStreamConstraints;
  userData?: object | null;
  iceServers?: RTCIceServer[];
  sdpHandler?: (
    sdp: RTCSessionDescriptionInit,
    originalHandler: (
      sdp: RTCSessionDescriptionInit
    ) => RTCSessionDescriptionInit
  ) => RTCSessionDescriptionInit;
}

export interface TVideoConfigs {
  bitRate: number;
  codec: '42e01f' | 'VP8' | 'VP9';
  frameRate: number;
}

export interface TAudioConfigs {
  bitRate: number;
  codec: 'opus';
}

export interface TStreamInfo {
  applicationName: string;
  sessionId: string;
  streamName: string;
}

export interface TStreamItem {
  streamName: string;
  readyAudio: boolean;
  readyVideo: boolean;
  codecAudio: number;
  codecVideo: number;
}

export interface TDeferred<T> {
  resolve: (data: T) => void;
  promise: Promise<T>;
  reject: (data: T & { status: number; statusDescription: string }) => void;
}

interface TSocketSendBase {
  direction: 'publish' | 'play';
  command: keyof TSocketSendData;
  streamInfo: TStreamInfo;
  userData: null;
}

interface TSocketRecvBase {
  direction: 'publish' | 'play';
  command: keyof TSocketRecvData;
  status: number;
  statusDescription: string;
}

export interface TSocketSendData {
  sendOffer: {
    direction: 'publish';
    command: 'sendOffer';
    sdp: RTCSessionDescriptionInit;
  };
  getOffer: {
    direction: 'play';
    command: 'getOffer';
  };
  sendResponse: {
    direction: 'play';
    command: 'sendResponse';
    sdp: RTCSessionDescriptionInit;
  };
  getAvailableStreams: {
    direction: 'play';
    command: 'getAvailableStreams';
  };
}

export interface TSocketRecvData {
  sendOffer: TSocketRecvBase & {
    direction: 'publish';
    command: 'sendOffer';
    sdp: RTCSessionDescriptionInit;
    iceCandidates: RTCIceCandidateInit[];
  };
  getOffer: TSocketSendBase & {
    direction: 'play';
    command: 'getOffer';
    sdp: RTCSessionDescriptionInit;
  };
  sendResponse: TSocketSendBase & {
    direction: 'play';
    command: 'sendResponse';
    iceCandidates: RTCIceCandidateInit[];
  };
  getAvailableStreams: TSocketSendBase & {
    direction: 'play';
    command: 'getAvailableStreams';
    availableStreams?: TStreamItem[];
  };
}
