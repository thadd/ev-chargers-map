import { PushRegistration } from "@aerogear/push";

function initialize(config) {
  setTimeout(() => {
    function deviceReady() {
      console.log('device is ready');
      window.open = window.cordova.InAppBrowser.open;

    //   console.log('registering push', config.getConfigByType('push'));
    //   (new PushRegistration(config)).register({timeout: 60000}).then(() => {
    //       console.log('push registration complete');
    //   }).catch(err => {
    //       console.error('push reg failed', err);
    //   });
    }

    document.addEventListener("deviceready", deviceReady, false);

    console.log('initialized cordova');
  }, 1);
}

export {initialize};