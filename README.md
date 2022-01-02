# chrome-ext-list-slack-users

A Google Chrome browser extension to download (1) the list of users from a particular Slack workspace at a particular channel and (2) the list of connections of a LinkedIn connection (given that their connections are public) as a CSV file.

**WARNING**: use it at your own risk! This is an unofficial extension (and I am not planning to publish it). Although this extension sniffs token/cookie, it will not be transferred anywhere (it will be _only_ used in this extension). I can guarantee that. However, I can't guarantee you the platform safety (e.g. if the platform catches you "abusing" the token/cookie and gives you a warning, that is beyond my responsibility).

## Motivation

If you are a hiring manager who wants to get a quick list of users from Slack or connections of a connection from LinkedIn, this extension can perhaps help a bit. Instead of having to click profiles one by one, this extension will give you a "surface" information depicted in the table below.

| Aspect           | Slack | LinkedIn |
| ---------------- | ----- | -------- |
| Name (Full Name) | ✓     | ✓        |
| Occupation       |       | ✓        |
| Location         |       | ✓        |
| Email            | ✓     | ✓        |
| Link             |       | ✓        |
| Alias (Username) | ✓     |          |
| Title            | ✓     |          |
| Timezone         | ✓     |          |

These information, however, are subject to the owner of each profile. If they do not disclose it, then some of the fields may be empty (e.g. people don't usually put their email in public Slack workspace).

## How to Use

1. Download the [zipped-source code](https://github.com/imballinst/chrome-ext-slack-linkedin-users-download/archive/refs/heads/main.zip).
2. Extract the compressed folder.
3. Open your Chrome, then go to [chrome://extensions](chrome://extensions).
4. Enable the "Developer Mode" switch on the top-right side.
5. Drag the extracted folder to the Extensions list.
6. Set it to disabled for now.

### Slack

1. Open the Slack workspace in your Chrome browser.
2. Once it has opened, go to the channel that you would want to download the list of users.
3. Enable the extension.
4. Refresh the page. This will download all users in that channel and save it as a CSV. The downloaded CSV format is `list_users_slack_YYYYMMDD.csv`.

### LinkedIn

1. Open the LinkedIn profile that you want to fetch their connections with in your Chrome browser.
2. Once it has opened, enable the extension..
3. Refresh the page. This will download all connections from that connection (up to 1000, due to LinkedIn limitations) and save it as a CSV. The downloaded CSV format is `list_users_linkedin-<connection_slug>_YYYYMMDD.csv`.

## How It Works

### Slack

When using this extension, we are giving it permissions to "sniff" network requests (use it at your own risk) from and to `*.slack.com`. The extension then gets the `token` and fires N requests (depending on how many users in that workspace). Then, the extension will construct a CSV file, then appends a "hidden link" on the page which has `href` attribute to that CSV file.

Finally, the extension will programatically click that link, which makes a download pop-up appears.

### LinkedIn

More or less the same with Slack, but the difference is, instead of hijacking the token, this extension will instead hijack the cookie instead.

## License

MIT
