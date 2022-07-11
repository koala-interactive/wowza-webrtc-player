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

  // For greatest playback compatibility,
  // force H.264 playback to constrained baseline (42e01f).
  // Adapted from https://www.wowza.com/wp-content/themes/wowzav1/webrtc-ui/wordpress-dev/1.2.8/lib/WowzaMungeSDP.js
  public transformPlay(
    description: RTCSessionDescriptionInit
  ): RTCSessionDescriptionInit {
    if (!description.sdp) {
      return description;
    }

    // The profile-level-id string has three parts: XXYYZZ, where
    //   XX: 42 baseline, 4D main, 64 high
    //   YY: constraint
    //   ZZ: level ID
    // Look for codecs higher than baseline and force downward.
    description.sdp = description.sdp.replace(
      /profile-level-id=(\w+)/gi,
      (_, $0) => {
        const profileId = parseInt($0, 16);
        let profile = (profileId >> 16) & 0xff;
        let constraint = (profileId >> 8) & 0xff;
        let level = profileId & 0xff;

        if (profile > 0x42) {
          profile = 0x42;
          constraint = 0xe0;
          level = 0x1f;
        } else if (constraint === 0x00) {
          constraint = 0xe0;
        }
        return `profile-level-id=${((profile << 16) | (constraint << 8) | level).toString(16)};`;
      }
    );
    return description;
  }

  public transformPublish(
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

              if (config?.bitRate && ['firefox', 'safari'].includes(browser)) {
                const bitRate = config.bitRate * 1000;
                const bitRateTIAS = bitRate * 0.95 - 50 * 40 * 8;

                line += `\r\nb=TIAS:${bitRateTIAS}`;
                line += `\r\nb=AS:${bitRate}`;
                line += `\r\nb=CT:${bitRate}`;
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
    let sdpSection = '';

    for (let i = 0, count = lines.length; i < count; ++i) {
      const line = lines[i];

      if (line.startsWith('m=audio')) {
        sdpSection = 'audio';
      } else if (line.startsWith('m=video')) {
        sdpSection = 'video';
      } else if (line === 'a=rtcp-mux' && sdpSection === 'audio') {
        const audioAddedBuffer = this.deliverCheckLine(
          this.audioOptions.codec,
          'audio',
          tmp
        );

        lines.splice(i + 1, 0, ...audioAddedBuffer);
        break;
      }
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
