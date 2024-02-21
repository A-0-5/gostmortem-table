![Gostmortem](assets/banner.png)

Gostmortem table is an extension that allows you to visualize go stack traces.

The parser component [gostackparser.go](src/gostackparser.ts) is based on  [gostackparse](https://github.com/DataDog/gostackparse) which parses a stack and provides a json object. 

## Usage

1. Paste any valid go stack trace
2. Invoke the extension using the shortcut to show all commands `cmd + shift + p` or `ctrl + shift + p`
3. select/search Visualize Stack Trace
4. The visualization table will open up

![demo](assets/demo.gif)


Any feedback is welcome.