const promises = [];
const windowThis = window;
let idx = 0;

setInterval(async () => {
  if (promises[idx] !== undefined) {
    const { id, headers } = promises[idx];

    idx += 1;

    let currentConnections;
    const COUNT = 50;
    const allConnections = [];
    let start = 0;

    while (currentConnections === undefined || currentConnections?.length > 0) {
      let waitTime = 2000;

      try {
        console.log(
          `fetching connections of ${id} from ${start} to ${start + COUNT}...`
        );

        const response1 = await windowThis.fetch(
          `https://www.linkedin.com/voyager/api/search/dash/clusters?decorationId=com.linkedin.voyager.dash.deco.search.SearchClusterCollection-123&origin=MEMBER_PROFILE_CANNED_SEARCH&q=all&query=(flagshipSearchIntent:SEARCH_SRP,queryParameters:(connectionOf:List(${id}),network:List(F,S),resultType:List(PEOPLE)),includeFiltersInResponse:false)&start=${start}&count=${COUNT}`,
          {
            method: "GET",
            headers,
          }
        );
        const json1 = await response1.json();
        console.log(json1);
        const connections = json1.included.filter((el) =>
          el.trackingUrn?.includes("urn:li:member")
        );

        currentConnections = connections;
        allConnections.push(
          ...currentConnections.map((el) => {
            const profileIdQueryStringIdxStart = el.navigationUrl.indexOf("?");
            const profileIdLastSlash = el.navigationUrl.lastIndexOf("/");
            const profileId = el.navigationUrl.slice(
              profileIdLastSlash + 1,
              profileIdQueryStringIdxStart
            );

            return {
              Name: el.title?.text,
              Occupation: el.primarySubtitle?.text,
              Location: el.secondarySubtitle?.text,
              Email: "",
              Link: `https://www.linkedin.com/in/${profileId}`,
              ProfileId: profileId,
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
              `https://www.linkedin.com/voyager/api/identity/profiles/${el.ProfileId}/profileContactInfo`,
              {
                method: "GET",
                headers,
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
    const JSON_FIELDS = ["Name", "Occupation", "Location", "Email", "Link"];
    downloadAsCsv(allConnections, JSON_FIELDS, "linkedin");
  }
}, 5000);

let profileName;

chrome.webRequest.onBeforeRequest.addListener(
  async function (info) {
    console.log("hey", info);
    if (
      info.method === "GET" &&
      info.initiator === "https://www.linkedin.com"
    ) {
      const pathnames = info.url.split("/");
      profileName = pathnames[pathnames.length - 2];
    }

    return { cancel: false };
  },
  {
    // Filters.
    urls: ["https://www.linkedin.com/voyager/api/identity/dash/profiles"],
  },
  [
    // This is the thing that we defined in `manifest.json`.
    // Both from `webRequest` and `webRequestBlocking`.
    "blocking",
    "requestBody",
  ]
);

chrome.webRequest.onBeforeSendHeaders.addListener(
  async function (info) {
    if (
      info.method === "GET" &&
      info.initiator === "https://www.linkedin.com"
    ) {
      const headers = getHeaders(info.requestHeaders);
      const response = await windowThis.fetch(
        `https://www.linkedin.com/voyager/api/identity/profiles/${profileName}/networkinfo`,
        {
          method: "GET",
          headers,
        }
      );
      const json = await response.json();
      const id = json.data.entityUrn.slice(
        "urn:li:fs_profileNetworkInfo:".length
      );

      promises.push({
        id,
        headers,
      });
    }
  },
  {
    // Filters.
    urls: [
      "https://www.linkedin.com/voyager/api/identity/profiles/*/browsemapWithDistance",
    ],
  },
  ["requestHeaders"]
);

// Helper functions.
async function wait(duration) {
  return new Promise((res) => {
    setTimeout(() => {
      res(undefined);
    }, duration);
  });
}

function getHeaders(requestHeaders) {
  const headers = {};

  for (const header of requestHeaders) {
    if (header.name.toLowerCase() !== "referer") {
      headers[header.name] = header.value;
    }
  }

  return headers;
}
