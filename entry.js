const _ = require("lodash"),
      fetch = require("node-fetch"),
      fb = require("fb"),
      moment = require("moment"),

      credentials = require("./credentials.json"),

      fbLogin = () => {
        return new Promise((resolve, reject) => {
          const FB = new fb.Facebook({
            appId: credentials.facebook.appId,
            appSecret: credentials.facebook.appSecret,
            version: "v2.9"
          });

          FB.api("oauth/access_token", {
              client_id: credentials.facebook.appId,
              client_secret: credentials.facebook.appSecret,
              grant_type: "client_credentials"
          }, function (res) {
              if(!res || res.error) {
                  console.log(!res ? "error occurred" : res.error);
                  return;
              }

              FB.setAccessToken(res.access_token);
              resolve(FB);
          });
        })
      },
      getFacebookFeeds = (FB, pageId) => {
        return new Promise((resolve, reject) => {
          FB.api(
            "/" + pageId + "/feed?fields=message,link,created_time",
            (res) => {
              if (!res || res.error) {
                reject(res.error);
              }

              resolve(res.data);
            }
          );
        }).then((_feeds) => {
          let feeds = _feeds.filter((feed) => { // Only posts in 25 hours
            const feedCreatedAt = moment(feed.created_time),
                  _24hoursAgo = moment().subtract(25, "hours");

            return feedCreatedAt.isAfter(_24hoursAgo);
          });

          feeds = feeds.map((feed) => {
            feed.author = pageId;
            return feed;
          });

          return Promise.resolve(feeds);
        });
      },
      addBuffer = (text) => {
        fetch("https://api.bufferapp.com/1/updates/create.json", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: "profile_ids[]=" + credentials.buffer.profileId +
                "&text=" + encodeURIComponent(text) +
                "&scheduled_at=2050-04-01" +
                "&access_token=" + credentials.buffer.accessToken
        }).then((res) => {
          if (res.status === 200) {
            return res.json().then((json) => {
              console.log(json.message);
            });
          } else {
            return res.text().then((body) => {
              console.log("HTTP " + res.status);

              try {
                const json = JSON.parse(body);
                console.log(JSON.stringify(json, null, "  "));
              } catch (err) {
                console.log(body);
              }
            });
          }
        }).catch((err) => {
          console.log(err);
        })
      }

fbLogin().then((FB) => {
  return Promise.all([
    getFacebookFeeds(FB, "kde"),
    getFacebookFeeds(FB, "kdeneon"),
    getFacebookFeeds(FB, "linuxkubuntu"),
    getFacebookFeeds(FB, "calligra"),
  ]);
}).then((feeds) => {
  feeds = _.flatten(feeds);

  return Promise.all(feeds.map((feed) => {
    return addBuffer(feed.message + "\n" + feed.link + "\n\nby " + feed.author);
  }));
}).catch((err) => {
  console.log(err);
})
