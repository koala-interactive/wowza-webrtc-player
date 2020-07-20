import { TVideoConfigs, TAudioConfigs } from '../../typings/wowza-types';

// Code adapted from https://github.com/WowzaMediaSystems/webrtc-examples/blob/master/src/lib/WowzaMungeSDP.js
import { browser } from '../utils/browser';

const SUPPORTED_VIDEO_FORMATS = ['vp9', 'vp8', 'h264', 'red', 'ulpfec', 'rtx'];
const SUPPORTED_AUDIO_FORMATS = ['opus', 'isac', 'g722', 'pcmu', 'pcma', 'cn'];

type TSection = 'm=audio' | 'm=video' | null;
type TCodecConfig = TVideoConfigs | TAudioConfigs | null;

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
    const video = this.videoOptions;
    const audio = this.audioOptions;

    let sdpSection: TSection = null;

    const getSectionConfig = (): TCodecConfig =>
      sdpSection === 'm=audio'
        ? audio
        : sdpSection === 'm=video'
        ? video
        : null;

    const sdp =
      lines
        .filter(Boolean)
        .map((line) => {
          const [header] = line.split(/\s|:/, 1);

          switch (header) {
            case 'm=audio':
            case 'm=video': {
              const offset =
                header === 'm=audio' ? this.audioIndex : this.videoIndex;

              if (offset !== -1 && browser === 'chrome') {
                const [header, port, proto /*, fmt*/] = line.split(' ');
                return `${header} ${port} ${proto} ${offset}`;
              }

              sdpSection = header;
              break;
            }

            case 'a=rtpmap': {
              const matches = /^a=rtpmap:(\d+)\s+(\w+)\/(\d+)/.exec(line);
              if (!matches || browser !== 'chrome') {
                break;
              }

              const format = matches[2].toLowerCase();

              if (video.bitRate && SUPPORTED_VIDEO_FORMATS.includes(format)) {
                line += `\r\na=fmtp:${matches[1]} x-google-min-bitrate=${video.bitRate};x-google-max-bitrate=${video.bitRate}`;
              }
              if (audio.bitRate && SUPPORTED_AUDIO_FORMATS.includes(format)) {
                line += `\r\na=fmtp:${matches[1]} x-google-min-bitrate=${audio.bitRate};x-google-max-bitrate=${audio.bitRate}`;
              }
              break;
            }

            case 'c=IN': {
              const config = getSectionConfig();

              if (
                config &&
                config.bitRate &&
                (browser === 'firefox' || browser === 'safari')
              ) {
                line += `\r\nb=TIAS:${config.bitRate * 1000}`;
                line += `\r\nb=AS:${config.bitRate * 1000}`;
                line += `\r\nb=CT:${config.bitRate * 1000}`;
              }
              break;
            }

            case 'a=mid': {
              const config = getSectionConfig();

              if (config && browser === 'chrome') {
                if (config.bitRate) {
                  line += `\r\nb=CT:${config.bitRate}`;
                  line += `\r\nb=AS:${config.bitRate}`;

                  if ('frameRate' in config && config.frameRate) {
                    line += `\r\na=framerate:${config.frameRate.toFixed(2)}`;
                  }
                }
                sdpSection = null;
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
          (transport) =>
            !transport.includes('transport-cc') &&
            !transport.includes('goog-remb') &&
            !transport.includes('nack')
        );
  }

  private addAudio(lines: string[], tmp: Map<number, string[]>): string[] {
    const pos = lines.indexOf('a=rtcp-mux');

    if (pos !== -1) {
      lines.splice(
        pos + 1,
        0,
        ...this.deliverCheckLine(this.audioOptions.codec, 'audio', tmp)
      );
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

    return lines.map((line) => {
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

  private flattenLines(lines: string[]): string[] {
    return lines.join('\r\n').split('\r\n');
  }

  private prepareSDP(description: RTCSessionDescriptionInit): string[] {
    const tmp = new Map<number, string[]>();
    const sdp = description.sdp || '';

    let lines = sdp.split(/\r\n/);
    lines = lines.filter((line) => line && this.checkLine(line, tmp));
    lines = this.flattenLines(this.addAudio(lines, tmp));
    lines = this.flattenLines(this.addVideo(lines, tmp));

    return lines;
  }
}
