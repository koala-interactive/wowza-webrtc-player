import { EventEmitter } from 'events';

import {
  TAudioConfigs,
  TPlayerOptions,
  TSecureToken,
  TStreamItem,
  TVideoConfigs,
} from '../typings/wowza-types';

import { PeerConnection } from './webrtc/PeerConnection';
import { SDPEnhancer } from './webrtc/SDPEnhancer';
import { Wowza } from './wowza/wowza';

export class WowzaWebRTCPlayer extends EventEmitter {
  public sdpUrl = '';
  public applicationName = '';
  public streamName = '';
  public userData: object | null = null;
  public sdpHandler: TPlayerOptions['sdpHandler'];
  public secureToken?: TSecureToken;

  public constraints: MediaStreamConstraints = {
    audio: true,
    video: true,
  };

  public videoConfigs: TVideoConfigs = {
    bitRate: 360,
    codec: '42e01f', // H264 - VP9
    frameRate: 29.97,
  };

  public audioConfigs: TAudioConfigs = {
    codec: 'opus',
    bitRate: 64,
  };

  public iceServers: RTCIceServer[] = [];

  private mediaStream: MediaStream | null = null;
  private pc: PeerConnection | null = null;

  constructor(private video: HTMLVideoElement, options?: TPlayerOptions) {
    super();

    if (options) {
      this.setConfigurations(options);
    }
  }

  private setConfigurations(options: TPlayerOptions): void {
    if (options.constraints) {
      this.constraints = options.constraints;
    }

    if (options.videoConfigs) {
      this.videoConfigs = options.videoConfigs;
    }

    if (options.audioConfigs) {
      this.audioConfigs = options.audioConfigs;
    }

    if (options.applicationName) {
      this.applicationName = options.applicationName;
    }

    if (options.streamName) {
      this.streamName = options.streamName;
    }

    if (options.sdpUrl) {
      this.sdpUrl = options.sdpUrl;
    }

    if (typeof options.userData !== 'undefined') {
      this.userData = options.userData;
    }

    if (options.iceServers) {
      this.iceServers = options.iceServers;
    }

    if (options.sdpHandler) {
      this.sdpHandler = options.sdpHandler;
    }

    if (options.secureToken) {
      this.secureToken = options.secureToken;
    }

    if (options.mediaStream) {
      this.mediaStream = options.mediaStream;
    }
  }

  public stop(): void {
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
  }

  public getMediaStream(): MediaStream | null {
    return this.mediaStream;
  }

  public getPeerConnection(): RTCPeerConnection | null {
    return this.pc ? this.pc.getPeerConnection() : null;
  }

  public async publish(options?: TPlayerOptions): Promise<void> {
    if (options) {
      this.setConfigurations(options);
    }

    const wowza = this.createWowzaInstance();

    try {
      const mediaStream = this.mediaStream;
      const pc = this.createPeerConnection();
      if (mediaStream !== null) {
        pc.attachMediaStream(mediaStream);

        const enhancer = new SDPEnhancer(this.videoConfigs, this.audioConfigs);
        const description = await pc.createOffer();
        const upgradedDescription = this.sdpHandler
          ? this.sdpHandler(
              description,
              (sdp) => enhancer.transformPublish(sdp),
              'publish'
            )
          : enhancer.transformPublish(description);

        await pc.setLocalDescription(upgradedDescription);
        const { sdp, iceCandidates } = await wowza.sendOffer(
          upgradedDescription
        );

        await pc.setRemoteDescription(sdp);
        iceCandidates.forEach((ice) => {
          pc.attachIceCandidate(ice);
        });
      } else {
        Promise.resolve();
      }
    } finally {
      wowza.disconnect();
    }
  }

  public async getAvailableStreams(): Promise<TStreamItem[]> {
    const wowza = this.createWowzaInstance();

    try {
      const { availableStreams } = await wowza.getAvailableStreams();
      return availableStreams || [];
    } catch (e) {
      return [];
    } finally {
      wowza.disconnect();
    }
  }

  private createWowzaInstance(): Wowza {
    const wowza = new Wowza(
      this.sdpUrl,
      {
        applicationName: this.applicationName,
        sessionId: '[empty]',
        streamName: this.streamName,
        secureToken: this.secureToken,
      },
      this.userData
    );

    return wowza;
  }

  private createPeerConnection(): PeerConnection {
    this.pc = new PeerConnection(this.iceServers);

    return this.pc;
  }

  public attachStream(stream: MediaStream): void {
    this.mediaStream = stream;

    try {
      const oldStream =
        this.video.srcObject instanceof MediaStream && this.video.srcObject;
      if (!oldStream || oldStream.id !== stream.id) {
        this.video.srcObject = stream;
      }
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore
      this.video.src = window.URL.createObjectURL(stream);
    }

    if (this.pc) {
      this.pc.attachMediaStream(stream);
    }

    this.video.play();
  }
}
