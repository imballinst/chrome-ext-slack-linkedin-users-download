const promises = [];
const windowThis = window;
const fetchedIds = [];
let idx = 0;
let profileName;

setInterval(async () => {
  if (promises[idx] !== undefined) {
    const { id, headers } = promises[idx];

    if (fetchedIds.includes(id)) {
      // Skip duplicate requests.
      return;
    }

    fetchedIds.push(id);
    idx += 1;

    let currentConnections;
    const COUNT = 50;
    const allConnections = [];
    let start = 0;

    while (currentConnections === undefined || currentConnections?.length > 0) {
      let waitTime = 2000;

      try {
        !fetchedIds.includes(id);
        console.log(
          `fetching connections of ${profileName} from ${start} to ${
            start + COUNT
          }...`
        );

        const searchResponse = await windowThis.fetch(
          `https://www.linkedin.com/voyager/api/search/dash/clusters?decorationId=com.linkedin.voyager.dash.deco.search.SearchClusterCollection-123&origin=MEMBER_PROFILE_CANNED_SEARCH&q=all&query=(flagshipSearchIntent:SEARCH_SRP,queryParameters:(connectionOf:List(${id}),network:List(F,S),resultType:List(PEOPLE)),includeFiltersInResponse:false)&start=${start}&count=${COUNT}`,
          {
            method: "GET",
            headers,
          }
        );
        const json = await searchResponse.json();
        const connections = json.included.filter((el) =>
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
              // These will be filled later.
              "Current Position": "",
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

    // Fetch email addresses.
    const SLICE_COUNT = 5;
    const allMiniProfiles = [];
    const allPositions = [];

    for (
      let i = 0, length = allConnections.length / SLICE_COUNT;
      i < length;
      i += 1
    ) {
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
      await wait(waitTime);
    }

    // Fetch current positions.
    for (
      let i = 0, length = allConnections.length / SLICE_COUNT;
      i < length;
      i += 1
    ) {
      const sliced = allConnections.slice(
        i * SLICE_COUNT,
        i * SLICE_COUNT + SLICE_COUNT
      );
      console.log(
        `fetching current positions from ${i * SLICE_COUNT} to ${
          i * SLICE_COUNT + SLICE_COUNT
        }...`
      );
      const responses = await Promise.all(
        sliced.map((el) =>
          windowThis
            .fetch(`https://www.linkedin.com/in/${el.ProfileId}`, {
              method: "GET",
              headers,
            })
            .then((res) => res.text())
        )
      );

      allPositions.push(...responses.map((res) => getCompanyName(res)));
      await wait(waitTime);
    }

    allMiniProfiles.forEach((el, idx) => {
      allConnections[idx].Email = el.emailAddress;
      allConnections[idx]["Current Position"] = allPositions[idx];
    });

    console.table(allConnections);
    const JSON_FIELDS = [
      "Name",
      "Occupation",
      "Current Position",
      "Location",
      "Email",
      "Link",
    ];
    downloadAsCsv(allConnections, JSON_FIELDS, `linkedin-${profileName}`);
  }
}, 5000);

chrome.webRequest.onBeforeRequest.addListener(
  async function (info) {
    if (
      info.method === "GET" &&
      info.initiator === "https://www.linkedin.com"
    ) {
      const pathnames = info.url.split("/");
      profileName = pathnames[pathnames.length - 2];

      console.log(
        `Initializing profile fetch for LinkedIn profile: ${profileName}`,
        info
      );
    }

    return { cancel: false };
  },
  {
    // Filters.
    urls: [
      "https://www.linkedin.com/voyager/api/identity/profiles/*/browsemapWithDistance",
      "https://www.linkedin.com/voyager/api/identity/profiles/*/opportunityCards?q=topCard",
    ],
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

      console.log(
        `Preparing profile fetch for LinkedIn profile: ${profileName} with ID ${id}`,
        info
      );
    } else {
      console.log(
        `Profile ${profileName} is already on fetching process. Skipping...`
      );
    }
  },
  {
    // Filters.
    urls: [
      "https://www.linkedin.com/voyager/api/identity/profiles/*/browsemapWithDistance",
      "https://www.linkedin.com/voyager/api/identity/profiles/*/opportunityCards?q=topCard",
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

function getMatchingCodeContainingEmployment(code) {
  try {
    const json = code.innerHTML.replace(/\n\s+/g, "");
    const parsed = JSON.parse(json);

    return parsed.included?.find(
      (yy) =>
        yy.dateRange &&
        yy.dateRange.end === undefined &&
        (yy.locationName !== undefined || yy.title !== undefined) &&
        yy["$type"] === "com.linkedin.voyager.dash.identity.profile.Position"
    );
  } catch (err) {
    return {};
  }
}

function getCompanyName(htmlString) {
  // Filter by code.
  const parsedHtml = $(htmlString);

  const codes = [];
  let companyName = "-";

  parsedHtml.each((_, e) => {
    if (e.localName === "code") {
      codes.push(getMatchingCodeContainingEmployment(e));
    }
  });

  const match = codes.find((c) => c !== undefined);
  if (match !== undefined) {
    companyName = match.title;
  }

  return companyName;
}
