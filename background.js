// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

const NUMBER_OF_FETCHED_USERS = 500;

chrome.webRequest.onBeforeRequest.addListener(
  async function (info) {
    if (info.method == 'POST' && info.initiator === 'https://app.slack.com') {
      // Use this to decode the body of your post
      const postedString = decodeURIComponent(
        String.fromCharCode.apply(
          null,
          new Uint8Array(info.requestBody.raw[0].bytes)
        )
      );
      const parsed = JSON.parse(postedString);
      parsed.count = NUMBER_OF_FETCHED_USERS;
      parsed.index = 'users_by_display_name';
      parsed.present_first = false;
      console.log(parsed);
      const filteredFieldUsers = [];
      let nextMarker = undefined;

      while (nextMarker !== null) {
        if (nextMarker) {
          parsed.marker = nextMarker;
        }

        const stringified = JSON.stringify(parsed);

        const response = await fetch(info.url, {
          method: 'POST',
          body: stringified,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.67 Safari/537.36'
          }
        });
        const json = await response.json();
        console.log(json);

        const mapped = json.results.map((el) => ({
          Alias: el.name || '-',
          'Full Name': el.real_name || '-',
          Timezone: el.tz || '-',
          Email: el.profile.email || '-'
        }));
        filteredFieldUsers.push(...mapped);

        if (json.next_marker === undefined) {
          nextMarker = null;
        } else {
          nextMarker = json.next_marker;
        }
      }

      console.log('final', filteredFieldUsers);

      const blob = new Blob([jsonToCSV(filteredFieldUsers)], {
        type: 'text/csv;charset=utf-8;'
      });
      if (navigator.msSaveBlob) {
        // IE 10+
        navigator.msSaveBlob(blob, 'list_users.csv');
      } else {
        const link = document.createElement('a');
        if (link.download !== undefined) {
          // feature detection
          // Browsers that support HTML5 download attribute
          const url = URL.createObjectURL(blob);
          link.setAttribute('href', url);
          link.setAttribute('download', 'list_users.csv');
          link.style.visibility = 'hidden';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }
    }

    return { cancel: false };
  },
  // filters
  {
    urls: ['https://edgeapi.slack.com/cache/*/users/list']
  },
  // extraInfoSpec
  ['blocking', 'requestBody']
);

const JSON_FIELDS = ['Alias', 'Full Name', 'Timezone', 'Email'];

function jsonToCSV(json) {
  let csvStr = JSON_FIELDS.join(',') + '\n';

  json.forEach((element) => {
    const row = JSON_FIELDS.map((key) => element[key]);

    csvStr += row.join(',') + '\n';
  });

  return csvStr;
}
