'use strict';

const NUMBER_OF_FETCHED_USERS_PER_REQUEST = 5000;
const promises = [];
const windowThis = window;
let idx = 0;

setInterval(async () => {
  if (promises[idx] !== undefined) {
    const { url, headers: requestHeaders } = promises[idx];
    const headers = {};

    idx += 1;

    for (const header of requestHeaders) {
      headers[header.name] = header.value;
    }

    const response = await windowThis.fetch(url, {
      method: 'GET',
      headers
    });
    const json = await response.json();
    const userId = json.data.entityUrn.slice('urn:li:fs_miniProfile:'.length);
    let currentConnections;
    const COUNT = 50;
    const allConnections = [];
    let start = 0;

    while (currentConnections === undefined || currentConnections?.length > 0) {
      let waitTime = 2000;

      try {
        console.log(
          `fetching connections from ${start} to ${start + COUNT}...`
        );

        const response1 = await windowThis.fetch(
          `https://www.linkedin.com/voyager/api/search/dash/clusters?decorationId=com.linkedin.voyager.dash.deco.search.SearchClusterCollection-103&origin=FACETED_SEARCH&q=all&query=(flagshipSearchIntent:SEARCH_SRP,queryParameters:(resultType:List(PEOPLE),network:List(F,S),connectionOf:List(${userId})),includeFiltersInResponse:false)&start=${start}&count=${COUNT}`,
          {
            method: 'GET',
            headers
          }
        );
        const json1 = await response1.json();
        const connections = json1.included.filter((el) =>
          el.trackingUrn?.includes('urn:li:member')
        );

        currentConnections = connections;
        allConnections.push(
          ...currentConnections.map((el) => {
            const profileIdQueryStringIdxStart = el.navigationUrl.indexOf('?');
            const profileIdLastSlash = el.navigationUrl.lastIndexOf('/');
            const profileId = el.navigationUrl.slice(
              profileIdLastSlash + 1,
              profileIdQueryStringIdxStart
            );

            return {
              Name: el.title?.text,
              Occupation: el.primarySubtitle?.text,
              Location: el.secondarySubtitle?.text,
              Email: '',
              Link: `https://www.linkedin.com/in/${profileId}`,
              ProfileId: profileId
            };
          })
        );
        start += COUNT;
      } catch (err) {
        console.error(err);

        if (err.status === 429) {
          // Too many requests.
          waitTime = 15000;
        }
      }

      await wait(waitTime);
    }

    const SLICE_COUNT = 5;
    const allMiniProfiles = [];
    for (let i = 0, length = allConnections.length / 5; i < length; i += 1) {
      const sliced = allConnections.slice(
        i * SLICE_COUNT,
        i * SLICE_COUNT + SLICE_COUNT
      );
      console.log(
        `fetching miniprofiles from ${i * SLICE_COUNT} to ${
          i * SLICE_COUNT + SLICE_COUNT
        }...`
      );
      const responses = await Promise.all(
        sliced.map((el) =>
          windowThis
            .fetch(
              `https://www.linkedin.com/voyager/api/identity/miniprofiles/${el.ProfileId}`,
              {
                method: 'GET',
                headers
              }
            )
            .then((res) => res.json())
        )
      );

      allMiniProfiles.push(...responses.map((res) => res.data));
      await wait(1000);
    }

    allMiniProfiles.forEach((el, idx) => {
      allConnections[idx].Email = el.emailAddress;
    });

    console.table(allConnections);
    const JSON_FIELDS = ['Name', 'Occupation', 'Location', 'Email', 'Link'];
    downloadAsCsv(allConnections, JSON_FIELDS);
  }
}, 5000);

let url;

chrome.webRequest.onBeforeRequest.addListener(
  async function (info) {
    // Allow accessing resources that are from `https://*.slack.com/*`.
    // This should be defined in `manifest.json`.
    if (info.method == 'POST' && info.initiator === 'https://app.slack.com') {
      const JSON_FIELDS = [
        'No.',
        'Alias',
        'Full Name',
        'Title',
        'Timezone',
        'Email'
      ];

      // Only fetch the list of users once for each browser load.
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
          Title: el.profile.title || '-',
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
      downloadAsCsv(filteredFieldUsers, JSON_FIELDS);
    }

    if (
      info.method === 'GET' &&
      info.initiator === 'https://www.linkedin.com'
    ) {
      url = info.url;
    }

    return { cancel: false };
  },
  {
    // Filters.
    urls: [
      'https://edgeapi.slack.com/cache/*/users/list',
      'https://www.linkedin.com/voyager/api/identity/miniprofiles/cheenu'
    ]
  },
  [
    // This is the thing that we defined in `manifest.json`.
    // Both from `webRequest` and `webRequestBlocking`.
    'blocking',
    'requestBody'
  ]
);

chrome.webRequest.onBeforeSendHeaders.addListener(
  function (info) {
    if (
      info.method === 'GET' &&
      info.initiator === 'https://www.linkedin.com'
    ) {
      promises.push({
        url,
        headers: info.requestHeaders
      });
    }
  },
  {
    // Filters.
    urls: ['https://www.linkedin.com/voyager/api/identity/miniprofiles/cheenu']
  },
  ['requestHeaders']
);

function downloadAsCsv(tabularData, fields) {
  // Download as CSV.
  // Note that to enable using extension, we need to add `downloads` permission.
  const blob = new Blob([jsonToCSV(tabularData, fields)], {
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

function jsonToCSV(json, fields) {
  let csvStr = fields.join(',') + '\n';

  json.forEach((element) => {
    const row = fields.map((key) => `"${element[key]}"`);

    csvStr += row.join(',') + '\n';
  });

  return csvStr;
}

// Helper fnuctions.
function parseQueryParameter(queryString) {
  const object = {};

  // Reference: https://reacttraining.com/react-router/web/example/query-parameters.
  const searchParams = new URLSearchParams(queryString);
  const it = searchParams.entries();

  // Set an iterator. Each element contains an element of `{ done: boolean, value: [key, value] }`.
  let value = it.next();

  while (!value.done) {
    object[value.value[0]] = value.value[1];

    value = it.next();
  }

  return object;
}

async function wait(duration) {
  return new Promise((res) => {
    setTimeout(() => {
      res(undefined);
    }, duration);
  });
}
