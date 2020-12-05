# chrome-ext-list-slack-users

A Google Chrome browser extension to download the list of users from a particular workspace as a CSV file.

## How to Use

1. Download the [zipped-source code](https://github.com/Imballinst/chrome-ext-list-slack-users/archive/v0.0.2.zip).
2. Extract the compressed folder.
3. Open your Chrome, then go to [chrome://extensions](chrome://extensions).
4. Drag the extracted folder to the Extensions list.
5. Ensure that the extension is enabled.
6. Open the Slack Workspace that you would like to fetch its list of users.
7. There should be a pop-up to download the list of users (in form of CSV).

## How It Works

When using this extension, we are giving it permissions to "sniff" network requests (use it at your own risk) from and to `*.slack.com`. The extension then gets the `token` and fires N requests (depending on how many users in that workspace). Then, the extension will construct a CSV file, then appends a "hidden link" on the page which has `href` attribute to that CSV file.

Finally, the extension will programatically click that link, which makes a download pop-up appears.

## License

MIT
