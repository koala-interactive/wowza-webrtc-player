import * as sdpTransform from 'sdp-transform';
import { TVideoConfigs, TAudioConfigs } from '../../typings/wowza-types';

// Code adapted from https://github.com/WowzaMediaSystems/webrtc-examples/blob/master/src/lib/WowzaMungeSDP.js
import { browser } from '../utils/browser';

const SUPPORTED_AUDIO_FORMATS = ['opus', 'isac', 'g722', 'pcmu', 'pcma', 'cn'];
const SUPPORTED_VIDEO_FORMATS = [
  'vp9',
  'vp8',
  'h264',
  'red',
  'ulpfec',
  'rtx',
  'av1',
];

export class SDPEnhancer {
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

    const resource = sdpTransform.parse(description.sdp);

    // The profile-level-id string has three parts: XXYYZZ, where
    //   XX: 42 baseline, 4D main, 64 high
    //   YY: constraint
    //   ZZ: level ID
    // Look for codecs higher than baseline and force downward.
    resource.media.forEach((media) => {
      media.fmtp.forEach((fmtp) => {
        fmtp.config = fmtp.config.replace(
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

            return `profile-level-id=${(
              (profile << 16) |
              (constraint << 8) |
              level
            ).toString(16)}`;
          }
        );
      });
    });

    description.sdp = sdpTransform.write(resource);

    return description;
  }

  public transformPublish(
    description: RTCSessionDescriptionInit
  ): RTCSessionDescriptionInit {
    if (!description.sdp) {
      return description;
    }

    const resource = sdpTransform.parse(description.sdp);
    const params = {
      audio: {
        config: this.audioOptions,
        supportedFormats: SUPPORTED_AUDIO_FORMATS,
      },
      video: {
        config: this.videoOptions,
        supportedFormats: SUPPORTED_VIDEO_FORMATS,
      },
    };

    resource.media.forEach((media) => {
      const options =
        media.type === 'video'
          ? params.video
          : media.type === 'audio'
          ? params.audio
          : null;

      if (!options) {
        return;
      }

      const config = options.config;

      if (config.bitRate && ['firefox', 'safari'].includes(browser)) {
        media.bandwidth = (media.bandwidth || [])
          .filter((data) => !['TIAS', 'AS', 'CT'].includes(data.type))
          .concat(
            {
              type: 'TIAS',
              limit: config.bitRate * 1000 * 0.95 - 50 * 40 * 8,
            },
            {
              type: 'AS',
              limit: config.bitRate * 1000,
            },
            {
              type: 'CT',
              limit: config.bitRate * 1000,
            }
          );
      }

      if ('frameRate' in config) {
        media.framerate = config.frameRate;
      }

      for (let i = 0; i < media.rtp.length; ) {
        const rtp = media.rtp[i];
        const supported = options.supportedFormats.includes(
          rtp.codec.toLowerCase()
        );

        // Remove unsupported medias
        if (!supported) {
          media.rtp.splice(i, 1);
          media.fmtp = media.fmtp.filter(
            (fmtp) => fmtp.payload !== rtp.payload
          );
          media.payloads = media.rtp.map((rtp) => rtp.payload).join(' ');
          media.rtcpFb = media.rtcpFb?.filter(
            (rtcpFb) => rtcpFb.payload !== rtp.payload
          );
          continue;
        }

        // Add bandwidth constraints to the codec.
        if (config.bitRate && browser === 'chrome') {
          media.fmtp
            .filter((fmtp) => fmtp.payload === rtp.payload)
            .forEach((fmtp) => {
              fmtp.config = fmtp.config.replace(
                /;?x-google-(min|max)-bitrate=(\d+)/g,
                ''
              );
              fmtp.config += `;x-google-min-bitrate=${config.bitRate};x-google-max-bitrate=${config.bitRate}`;
            });
        }

        i++;
      }
    });

    description.sdp = sdpTransform.write(resource);

    return description;
  }
}
