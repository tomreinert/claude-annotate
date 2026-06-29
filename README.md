# Claude Annotate

Draw your feedback onto your frontend and send it straight to Claude.

🧪 Work in progress, I'm still testing this as I build.

<img width="1000" height="545" alt="annotate" src="https://github.com/user-attachments/assets/4baa8df2-e326-4575-9ddd-8ab25e5f36ba" />


## Install
You need the [Playwright MCP](https://playwright.dev/docs/getting-started-mcp) connected:
```bash
claude mcp add playwright npx @playwright/mcp@latest
```

Then install the plugin:

```bash
claude plugin marketplace add tomreinert/claude-annotate
claude plugin install annotate@tom-tools --scope user
```



## Use

Launch Claude Code with the channel turned on:

```bash
claude --dangerously-load-development-channels plugin:annotate@tom-tools
```

1. Type `/annotate`. Claude launches a Playwright browser with the annotation toolbar.
2. Draw your feedback and hit **Send**. Claude makes the changes.
3. Profit!

Keep drawing and sending as often as you like. Say "stop reviewing" when you are done.

See the [full guide](GUIDE.md) for the toolbar shortcuts and FAQ (including why the
`--dangerously-load-development-channels` flag is safe and how to skip it).


## Notes

This works quite well in my local setup with an app running on localhost:3000.
Many moving parts though, so I'm curious how it works in different enviroments. 

Looking forward to feedback and issues!