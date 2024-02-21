import { ThemeColor, Disposable, Webview, WebviewPanel, window, Uri, ViewColumn } from "vscode";
import { getUri } from "./getUri";
import { getNonce } from "./getNonce";
import { Goroutine, Frame } from "./gostackparser";

/**
 * This class manages the state and behavior of EditableDataGrid webview panels.
 *
 * It contains all the data and methods for:
 *
 * - Creating and rendering EditableDataGrid webview panels
 * - Properly cleaning up and disposing of webview resources when the panel is closed
 * - Setting the HTML (and by proxy CSS/JavaScript) content of the webview panel
 */
export class GostmortemDataGridPanel {
  public static currentPanel: GostmortemDataGridPanel | undefined;
  private readonly _panel: WebviewPanel;
  private _disposables: Disposable[] = [];

  /**
   * The EditableDataGridPanel class private constructor (called only from the render method).
   *
   * @param panel A reference to the webview panel
   * @param extensionUri The URI of the directory containing the extension
   */
  private constructor(panel: WebviewPanel, extensionUri: Uri, stacks: Goroutine[]) {
    this._panel = panel;

    // Set an event listener to listen for when the panel is disposed (i.e. when the user closes
    // the panel or when the panel is closed programmatically)
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Set the HTML content for the webview panel
    this._panel.webview.html = this._getWebviewContent(this._panel.webview, extensionUri, stacks);
  }

  /**
   * Renders the current webview panel if it exists otherwise a new webview panel
   * will be created and displayed.
   *
   * @param extensionUri The URI of the directory containing the extension.
   */
  public static render(extensionUri: Uri, stacks: Goroutine[]) {
    if (GostmortemDataGridPanel.currentPanel) {
      // If the webview panel already exists reveal it
      GostmortemDataGridPanel.currentPanel._panel.webview.html = GostmortemDataGridPanel.currentPanel._getWebviewContent(GostmortemDataGridPanel.currentPanel._panel.webview, extensionUri, stacks);
      GostmortemDataGridPanel.currentPanel._panel.reveal(ViewColumn.One);
    } else {
      // If a webview panel does not already exist create and show a new one
      const panel = window.createWebviewPanel(
        // Panel view type
        "showEditableDataGrid",
        // Panel title
        "gostmortem",
        // The editor column the panel should be displayed in
        ViewColumn.One,
        // Extra panel configurations
        {
          // Enable JavaScript in the webview
          enableScripts: true,
          // Restrict the webview to only load resources from the `out` directory
          localResourceRoots: [Uri.joinPath(extensionUri, "out"), Uri.joinPath(extensionUri, 'node_modules', '@vscode/codicons', 'dist')],
        }
      );

      GostmortemDataGridPanel.currentPanel = new GostmortemDataGridPanel(panel, extensionUri, stacks);
    }
  }

  /**
   * Cleans up and disposes of webview resources when the webview panel is closed.
   */
  public dispose() {
    GostmortemDataGridPanel.currentPanel = undefined;

    // Dispose of the current webview panel
    this._panel.dispose();

    // Dispose of all disposables (i.e. commands) associated with the current webview panel
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  /**
   * Defines and returns the HTML that should be rendered within the webview panel.
   *
   * @remarks This is also the place where *references* to CSS and JavaScript files
   * are created and inserted into the webview HTML.
   *
   * @param webview A reference to the extension webview
   * @param extensionUri The URI of the directory containing the extension
   * @returns A template string literal containing the HTML that should be
   * rendered within the webview panel
   */
  private _getWebviewContent(webview: Webview, extensionUri: Uri, stacks: Goroutine[]) {
    const nonce = getNonce();
    const webviewUri = getUri(webview, extensionUri, ["out", "webview.js"]);
    const codiconsUri = getUri(webview, extensionUri, ['node_modules', '@vscode/codicons', 'dist', 'codicon.css']);
    // Tip: Install the es6-string-html VS Code extension to enable code highlighting below
    return /*html*/ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <style>
            details > *:not(summary,p,br){
              margin-left: 0.8em;
              border-left: 1px solid var(--vscode-editorLineNumber-foreground);
            }

            details {
              background-color: var(--vscode-tab-inactiveBackground);
              border: 0.1em none;
              border-radius: 0.6em;
            }

            summary {
              border: 0.1em none;
              padding: 0.3em; 
              border-radius: 0.6em;
              background-color: var(--vscode-menu-background);
            }

            vscode-badge {
              vertical-align: middle;
            }

            vscode-data-grid-cell[grid-column="3"] {
              text-align: right;
            }

            .codicon[class*='codicon-']{
              vertical-align: bottom;
            }

            .codicon[class*='codicon-debug-line-by-line']{
              color: var(--vscode-charts-yellow)
            }

            .codicon[class*='codicon-symbol-namespace']{
              color: var(--vscode-charts-purple)
            }

            .codicon[class*='codicon-file-code']{
              color: var(--vscode-charts-blue)
            }

            .codicon[class*='codicon-layers']{
              color: var(--vscode-charts-orange)
            }

            .borderRow{
              border-top:1px solid var(--vscode-editorLineNumber-foreground);
            }
          </style>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
					<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource}; style-src ${webview.cspSource};">
          <link href="${codiconsUri}" rel="stylesheet" />
          <title>Editable Data Grid</title>
        </head>
        <body>
          ${this._getBody(stacks)}
          <script type="module" nonce="${nonce}" src="${webviewUri}"></script>
        </body>
      </html>
    `;
    //   return /*html*/ `
    //   <!DOCTYPE html>
    //   <html lang="en">
    //     <head>
    //       <meta charset="UTF-8">
    //       <meta name="viewport" content="width=device-width, initial-scale=1.0">
    //       <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}';">
    //       <title>Editable Data Grid</title>
    //     </head>
    //     <body>
    //     <vscode-data-grid aria-label="Basic">
    //     <vscode-data-grid-row row-type="header">
    //       <vscode-data-grid-cell cell-type="columnheader" grid-column="1">Header 1</vscode-data-grid-cell>
    //       <vscode-data-grid-cell cell-type="columnheader" grid-column="2">Header 2</vscode-data-grid-cell>
    //       <vscode-data-grid-cell cell-type="columnheader" grid-column="3">Header 3</vscode-data-grid-cell>
    //       <vscode-data-grid-cell cell-type="columnheader" grid-column="4">Header 4</vscode-data-grid-cell>
    //     </vscode-data-grid-row>
    //     <vscode-data-grid-row>
    //       <vscode-data-grid-cell grid-column="1">Cell Data</vscode-data-grid-cell>
    //       <vscode-data-grid-cell grid-column="2">Cell Data</vscode-data-grid-cell>
    //       <vscode-data-grid-cell grid-column="3">Cell Data</vscode-data-grid-cell>
    //       <vscode-data-grid-cell grid-column="4">Cell Data</vscode-data-grid-cell>
    //     </vscode-data-grid-row>
    //     <vscode-data-grid-row>
    //       <vscode-data-grid-cell grid-column="1">Cell Data</vscode-data-grid-cell>
    //       <vscode-data-grid-cell grid-column="2">Cell Data</vscode-data-grid-cell>
    //       <vscode-data-grid-cell grid-column="3">Cell Data</vscode-data-grid-cell>
    //       <vscode-data-grid-cell grid-column="4">Cell Data</vscode-data-grid-cell>
    //     </vscode-data-grid-row>
    //     <vscode-data-grid-row>
    //       <vscode-data-grid-cell grid-column="1">Cell Data</vscode-data-grid-cell>
    //       <vscode-data-grid-cell grid-column="2">Cell Data</vscode-data-grid-cell>
    //       <vscode-data-grid-cell grid-column="3">Cell Data</vscode-data-grid-cell>
    //       <vscode-data-grid-cell grid-column="4">Cell Data</vscode-data-grid-cell>
    //     </vscode-data-grid-row>
    //   </vscode-data-grid>
    //   <script type="module" nonce="${nonce}" src="${webviewUri}"></script>
    //     </body>
    //   </html>
    // `;
  }

  private _getBody(stacks: Goroutine[]) {
    let body: string = ``;
    stacks.forEach((stack) => {
      body = body.concat(this._parseRoutine(stack));
    });
    return body;
  }

  private _parseRoutine(routine: Goroutine | undefined) {
    if (routine) {

      let current: string =/*html*/ `
        <br>
        <details>
          <summary>
            ${this._getRoutineSummary(routine)}
          </summary>
          <p>
          <vscode-data-grid id="${routine.ID}" grid-template-columns="1fr 1fr 6fr">
          ${this._getStackString(routine.Stack)}
          </vscode-data-grid>
          ${this._parseRoutine(routine.Ancestor)}
          </p>
        </details>
        `;
      return current;
    }

    return ``;
  }

  private _getRoutineSummary(routine: Goroutine | undefined){
    let data: string = ``;
    if (routine) {
      data  = data.concat(/*html*/`
      <vscode-badge><i class="codicon codicon-info"></i>&nbsp;&nbsp;ID: ${routine.ID}</vscode-badge> 
      `);
      if (routine.State.length !== 0) {
        data = data.concat(/*html*/`<vscode-badge><i class="codicon codicon-debug-continue"></i>&nbsp;&nbsp;State: ${routine.State}</vscode-badge> 
        `);
      }

      if (routine.Wait !== 0 ) {
        data = data.concat(/*html*/`<vscode-badge><i class="codicon codicon-history"></i>&nbsp;&nbsp;Wait (ms): ${routine.Wait}</vscode-badge> 
        `);
      }

      if (routine.LockedToThread) {
        data = data.concat(/*html*/`<vscode-badge><i class="codicon codicon-lock"></i>&nbsp;&nbsp;Locked to Thread</vscode-badge> 
        `);
      }

      if (routine.FramesElided) {
        data = data.concat(/*html*/`<vscode-badge><i class="codicon codicon-clear-all"></i>&nbsp;&nbsp;Frames Elided</vscode-badge> 
        `);
      }

      if (routine.Ancestor) {
        data = data.concat(/*html*/`<vscode-badge><i class="codicon codicon-source-control"></i>&nbsp;&nbsp;Originator ID: ${routine.Ancestor!.ID}</vscode-badge>
        `);
      }
      if (routine.CreatedBy.File.length !== 0) {
        data = data.concat(/*html*/`
        <br>
        <vscode-data-grid id="creator-${routine.ID}" grid-template-columns="1fr 3fr">
        <vscode-data-grid-row row-type="header">
        <vscode-data-grid-cell cell-type="columnheader" grid-column="1"><i class="codicon codicon-indent"></i>&nbsp;&nbsp;Created By</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row class="borderRow">
          <vscode-data-grid-cell grid-column="1">&nbsp;</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2"><i class="codicon codicon-symbol-namespace"></i>&nbsp;${routine.CreatedBy.Func}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1"><i class="codicon codicon-debug-line-by-line"></i>&nbsp;${routine.CreatedBy.Line}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2"><i class="codicon codicon-file-code"></i>&nbsp;${routine.CreatedBy.File}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        </vscode-data-grid>
        `);
      }

    }

    return data;
  }

  private _getStackString(frames: Frame[]) {
    let data: string = /*html*/` `;

    frames.forEach((frm,i) => {
      data = data.concat(/*html*/`
        <vscode-data-grid-row ${i?'class="borderRow"':''}>
          <vscode-data-grid-cell grid-column="1"><i class="codicon codicon-layers"></i>&nbsp;&nbsp;${frames.length-i}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">&nbsp;&nbsp;</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="3"><i class="codicon codicon-symbol-namespace"></i>&nbsp;&nbsp;${frm.Func}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
        <vscode-data-grid-cell grid-column="1">&nbsp;&nbsp;</vscode-data-grid-cell>
        <vscode-data-grid-cell grid-column="2"><i class="codicon codicon-debug-line-by-line"></i>&nbsp;&nbsp;${frm.Line}</vscode-data-grid-cell>
        <vscode-data-grid-cell grid-column="3"><i class="codicon codicon-file-code"></i>&nbsp;&nbsp;${frm.File}</vscode-data-grid-cell>
        </vscode-data-grid-row>
      `);
    });

    return data;
  }
}
