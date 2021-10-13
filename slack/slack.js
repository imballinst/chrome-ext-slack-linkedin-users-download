chrome.webRequest.onBeforeRequest.addListener(
  async function (info) {
    // Allow accessing resources that are from `https://*.slack.com/*`.
    // This should be defined in `manifest.json`.
    if (info.method == "POST" && info.initiator === "https://app.slack.com") {
      const JSON_FIELDS = [
        "No.",
        "Alias",
        "Full Name",
        "Title",
        "Timezone",
        "Email",
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
      parsed.index = "users_by_display_name";
      parsed.present_first = false;

      const filteredFieldUsers = [];
      let nextMarker = undefined;

      while (nextMarker !== null) {
        if (nextMarker) {
          parsed.marker = nextMarker;
        }

        const stringified = JSON.stringify(parsed);

        const response = await fetch(info.url, {
          method: "POST",
          body: stringified,
          headers: {
            "Content-Type": "application/json",
          },
        });
        const json = await response.json();

        const mapped = json.results.map((el, idx) => ({
          "No.": filteredFieldUsers.length + idx + 1,
          Alias: el.name || "-",
          "Full Name": el.real_name || "-",
          Title: el.profile.title || "-",
          Timezone: el.tz || "-",
          Email: el.profile.email || "-",
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

    return { cancel: false };
  },
  {
    // Filters.
    urls: ["https://edgeapi.slack.com/cache/*/users/list"],
  },
  [
    // This is the thing that we defined in `manifest.json`.
    // Both from `webRequest` and `webRequestBlocking`.
    "blocking",
    "requestBody",
  ]
);
