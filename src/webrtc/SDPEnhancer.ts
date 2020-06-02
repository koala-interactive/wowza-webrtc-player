const SUPPORTED_VIDEO_FORMATS = ['vp9', 'vp8', 'h264', 'red', 'ulpfec', 'rtx'];
const SUPPORTED_AUDIO_FORMATS = ['opus', 'isac', 'g722', 'pcmu', 'pcma', 'cn'];

export class SDPEnhancer {
  private audioIndex = -1;
  private videoIndex = -1;

  constructor(
    private videoOptions: TVideoConfigs,
    private audioOptions: TAudioConfigs
  ) {}

  public transform(
    description: RTCSessionDescriptionInit
  ): RTCSessionDescriptionInit {
    const lines = this.prepareSDP(description);

    let sdpSection = 'header';
    let hitMID = false;

    const sdp =
      lines
        .filter(Boolean)
        .map(line => {
          if (line.startsWith('m=audio')) {
            if (this.audioIndex !== -1) {
              return line
                .split(' ')
                .slice(0, 3)
                .concat(this.audioIndex.toString())
                .join(' ');
            }

            sdpSection = 'audio';
            hitMID = false;
            return line;
          }

          if (line.startsWith('m=video')) {
            if (this.videoIndex !== -1) {
              return line
                .split(' ')
                .slice(0, 3)
                .concat(this.videoIndex.toString())
                .join(' ');
            }

            sdpSection = 'video';
            hitMID = false;
            return line;
          }

          if (line.startsWith('a=rtpmap')) {
            sdpSection = 'bandwidth';
            hitMID = false;
          }

          if (
            hitMID ||
            (!line.startsWith('a=mid:') && !line.startsWith('a=rtpmap'))
          ) {
            return line;
          }

          switch (sdpSection) {
            case 'audio':
              hitMID = true;
              return (
                line +
                (this.audioOptions.bitRate
                  ? `\r\nb=CT:${this.audioOptions.bitRate}\r\nb=AS:${this.audioOptions.bitRate}`
                  : '')
              );

            case 'video':
              hitMID = true;
              return (
                line +
                (this.videoOptions.bitRate
                  ? `\r\nb=CT:${this.videoOptions.bitRate}\r\nb=AS:${
                      this.videoOptions.bitRate
                    }${
                      this.videoOptions.frameRate
                        ? `\r\na=framerate:${this.videoOptions.frameRate.toFixed(
                            2
                          )}`
                        : ''
                    }`
                  : '')
              );

            case 'bandwidth': {
              const rtpmapID = /^a=rtpmap:(\d+)\s(\w+)\/(\d+)/.exec(line);
              if (rtpmapID == null) {
                break;
              }

              const match = rtpmapID[2].toLowerCase();

              if (
                this.videoOptions.bitRate &&
                SUPPORTED_VIDEO_FORMATS.includes(match)
              ) {
                line +=
                  '\r\na=fmtp:' +
                  rtpmapID[1] +
                  ' x-google-min-bitrate=' +
                  this.videoOptions.bitRate +
                  ';x-google-max-bitrate=' +
                  this.videoOptions.bitRate;
              }

              if (
                this.audioOptions.bitRate &&
                SUPPORTED_AUDIO_FORMATS.includes(match)
              ) {
                line +=
                  '\r\na=fmtp:' +
                  rtpmapID[1] +
                  ' x-google-min-bitrate=' +
                  this.audioOptions.bitRate +
                  ';x-google-max-bitrate=' +
                  this.audioOptions.bitRate;
              }
              break;
            }
          }

          return line;
        })
        .join('\r\n') + '\r\n';

    return {
      type: description.type,
      sdp,
    };
  }

  private checkLine(line: string, tmp: Map<number, string[]>): boolean {
    if (/^a=(rtpmap|rtcp-fb|fmtp)/.test(line)) {
      const res = line.split(':');

      if (res.length > 1) {
        const [index, data] = res[1].split(' ');

        if (!data.startsWith('http') && !data.startsWith('ur')) {
          const position = parseInt(index, 10);
          const list = tmp.get(position) || [];
          list.push(line);
          tmp.set(position, list);
          return false;
        }
      }
    }

    return true;
  }

  private deliverCheckLine(
    profile: string,
    type: 'audio' | 'video',
    tmp: Map<number, string[]>
  ): string[] {
    const entry = Array.from(tmp).find(([, lines]) =>
      lines.join('\r\n').includes(profile)
    );

    if (!entry) {
      return [];
    }

    const [index, lines] = entry;

    if (type === 'audio') {
      this.audioIndex = index;
    } else {
      this.videoIndex = index;
    }

    return profile !== 'VP8' && profile !== 'VP9'
      ? lines
      : lines.filter(
          transport =>
            !transport.includes('transport-cc') &&
            !transport.includes('goog-remb') &&
            !transport.includes('nack')
        );
  }

  private addAudio(lines: string[], tmp: Map<number, string[]>): string[] {
    const pos = lines.findIndex(line => line === 'a=rtcp-mux');

    if (pos !== -1) {
      const updatedAudio = this.deliverCheckLine(
        this.audioOptions.codec,
        'audio',
        tmp
      );
      lines.splice(pos + 1, 0, ...updatedAudio);
    }

    return lines;
  }

  private addVideo(lines: string[], tmp: Map<number, string[]>): string[] {
    const rtcpSize = lines.includes('a=rtcp-rsize');
    const rtcMux = lines.includes('a=rtcp-mux');
    let done = false;

    if (!rtcpSize && !rtcMux) {
      return lines;
    }

    const videoAddedBuffer = this.deliverCheckLine(
      this.videoOptions.codec,
      'video',
      tmp
    );

    return lines.map(line => {
      if (rtcpSize) {
        if (!done && line === 'a=rtcp-rsize') {
          done = true;
          return [line].concat(videoAddedBuffer).join('\r\n');
        }
      } else if (line === 'a=rtcp-mux') {
        if (done) {
          return [line].concat(videoAddedBuffer).join('\r\n');
        }
        done = true;
      }

      return line;
    });
  }

  // Firefox provides a reasonable SDP, Chrome is just odd
  // so we have to doing a little mundging to make it all work
  private prepareSDP(description: RTCSessionDescriptionInit): string[] {
    const sdp = description.sdp || '';
    let lines = sdp.split(/\r\n/);

    if (this.videoOptions.codec !== 'VP9' && sdp.includes('THIS_IS_SDPARTA')) {
      return lines;
    }

    const tmp = new Map<number, string[]>();

    lines = lines.filter(line => line && this.checkLine(line, tmp));
    lines = this.addAudio(lines, tmp)
      .join('\r\n')
      .split('\r\n');
    lines = this.addVideo(lines, tmp)
      .join('\r\n')
      .split('\r\n');

    return lines;
  }
}
