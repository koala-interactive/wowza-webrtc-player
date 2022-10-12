export function getUserMedia(
  constraints: MediaStreamConstraints
): Promise<MediaStream> {
  if (navigator.mediaDevices?.getUserMedia) {
    return navigator.mediaDevices.getUserMedia(constraints);
  }

  const nav: any = window.navigator;
  if (nav.getUserMedia) {
    return new Promise((resolve, reject) => {
      nav.getUserMedia(constraints, resolve, reject);
    });
  }

  return Promise.reject('Your browser does not support getUserMedia API');
}
