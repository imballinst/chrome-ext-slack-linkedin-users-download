'use strict';

const NUMBER_OF_FETCHED_USERS_PER_REQUEST = 500;
let hasFetched = false;

chrome.webRequest.onBeforeRequest.addListener(
  async function (info) {
    // Allow accessing resources that are from `https://*.slack.com/*`.
    // This should be defined in `manifest.json`.
    if (
      info.method == 'POST' &&
      info.initiator === 'https://app.slack.com' &&
      !hasFetched
    ) {
      // Only fetch the list of users once for each browser load.
      hasFetched = true;

      // Decode the request body's "raw stream".
      const postedString = decodeURIComponent(
        String.fromCharCode.apply(
          null,
          new Uint8Array(info.requestBody.raw[0].bytes)
        )
      );

      const parsed = JSON.parse(postedString);
      parsed.count = NUMBER_OF_FETCHED_USERS_PER_REQUEST;
      parsed.index = 'users_by_display_name';
      // Remove the filter when we first fetch when arriving at *.slack.com.
      parsed.channels = undefined;
      parsed.present_first = false;

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
            'Content-Type': 'application/json'
          }
        });
        const json = await response.json();

        const mapped = json.results.map((el, idx) => ({
          'No.': filteredFieldUsers.length + idx + 1,
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

      // Download as CSV.
      // Note that to enable using extension, we need to add `downloads` permission.
      const blob = new Blob([jsonToCSV(filteredFieldUsers)], {
        type: 'text/csv;charset=utf-8;'
      });

      if (navigator.msSaveBlob) {
        // Internet Explorer 10+ support.
        navigator.msSaveBlob(blob, 'list_users.csv');
      } else {
        // Other browsers.
        const link = document.createElement('a');

        // Create a "hidden" element that we are going to click to download the CSV file.
        if (link.download !== undefined) {
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
  {
    // Filters.
    urls: ['https://edgeapi.slack.com/cache/*/users/list']
  },
  // This is the thing that we defined in `manifest.json`.
  // Both from `webRequest` and `webRequestBlocking`.
  ['blocking', 'requestBody']
);

const JSON_FIELDS = ['No.', 'Alias', 'Full Name', 'Timezone', 'Email'];

function jsonToCSV(json) {
  let csvStr = JSON_FIELDS.join(',') + '\n';

  json.forEach((element) => {
    const row = JSON_FIELDS.map((key) => element[key]);

    csvStr += row.join(',') + '\n';
  });

  return csvStr;
}
