import { EventEmitter } from 'events';

const RTCPeerConnectionAPI =
  window.RTCPeerConnection; /* ||
  window.mozRTCPeerConnection ||
  window.webkitRTCPeerConnection*/

const RTCIceCandidateAPI =
  window.RTCIceCandidate; /* ||
  window.mozRTCIceCandidate ||
  window.webkitRTCIceCandidate*/

const RTCSessionDescriptionAPI =
  window.RTCSessionDescription; /* ||
  window.mozRTCSessionDescription ||
  window.webkitRTCSessionDescription*/

export class PeerConnection extends EventEmitter {
  private pc: RTCPeerConnection;

  constructor(iceServers?: RTCIceServer[]) {
    super();

    this.pc = new RTCPeerConnectionAPI({
      iceServers,
    });

    if ('ontrack' in this.pc) {
      this.pc.ontrack = this.handleTrackEvent.bind(this);
    } else {
      // Deprecated API support
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore
      this.pc.onaddstream = this.handleNewStreamEvent.bind(this);
    }
  }

  public getPeerConnection(): RTCPeerConnection {
    return this.pc;
  }

  public close(): void {
    this.pc.close();
  }

  public setRemoteDescription(
    description: RTCSessionDescriptionInit
  ): Promise<void> {
    return this.pc.setRemoteDescription(
      new RTCSessionDescriptionAPI(description)
    );
  }

  public setLocalDescription(
    description: RTCSessionDescriptionInit
  ): Promise<void> {
    return this.pc.setLocalDescription(
      new RTCSessionDescriptionAPI(description)
    );
  }

  public async createAnswer(): Promise<RTCSessionDescriptionInit> {
    return this.pc.createAnswer();
  }

  public async createOffer(): Promise<RTCSessionDescriptionInit> {
    return this.pc.createOffer();
  }

  public attachIceCandidate(iceData: RTCIceCandidateInit): Promise<void> {
    return this.pc.addIceCandidate(new RTCIceCandidateAPI(iceData));
  }

  public attachMediaStream(mediaStream: MediaStream): void {
    const pc = this.pc;
    const senders = pc.getSenders();
    const tracks = mediaStream.getTracks();

    if (!senders.length) {
      tracks.forEach((track) => {
        pc.addTrack(track, mediaStream);
      });
    } else {
      tracks.forEach((track) => {
        senders
          .filter((sender) => sender.track?.kind === track.kind)
          .forEach((sender) => {
            sender.replaceTrack(track);
          });
      });
    }
  }

  private handleNewStreamEvent({ stream }: MediaStreamEvent): void {
    this.emit('addstream', stream);
  }

  private handleTrackEvent(event: RTCTrackEvent): void {
    event.streams.forEach((stream) => {
      this.emit('addstream', stream);
    });
  }
}
