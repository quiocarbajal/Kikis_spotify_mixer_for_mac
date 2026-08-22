import Cocoa
import WebKit

class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var serverProcess: Process?

    func applicationDidFinishLaunching(_ notification: Notification) {
        setupMenuBar()
        launchSpotifyAppIfNeeded()
        startBackendServerIfNeeded()

        let screenSize = NSScreen.main?.frame.size ?? CGSize(width: 1440, height: 900)
        let windowWidth: CGFloat = min(1380, screenSize.width * 0.9)
        let windowHeight: CGFloat = min(880, screenSize.height * 0.88)
        let rect = NSRect(
            x: (screenSize.width - windowWidth) / 2,
            y: (screenSize.height - windowHeight) / 2,
            width: windowWidth,
            height: windowHeight
        )

        window = NSWindow(
            contentRect: rect,
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "Kiki's Spotify Mixer"
        window.isMovable = true
        window.isMovableByWindowBackground = true
        window.minSize = NSSize(width: 850, height: 550)
        window.backgroundColor = NSColor(red: 0.07, green: 0.07, blue: 0.07, alpha: 1.0)

        let config = WKWebViewConfiguration()
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")
        
        webView = WKWebView(frame: window.contentView!.bounds, configuration: config)
        webView.autoresizingMask = [.width, .height]
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.setValue(false, forKey: "drawsBackground")

        window.contentView?.addSubview(webView)
        window.center()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        loadAppURL()
    }

    func launchSpotifyAppIfNeeded() {
        let spotifyPath = "/Applications/Spotify.app"
        if FileManager.default.fileExists(atPath: spotifyPath) {
            let proc = Process()
            proc.executableURL = URL(fileURLWithPath: "/usr/bin/open")
            proc.arguments = ["-g", "-j", "-a", spotifyPath]
            proc.standardOutput = FileHandle.nullDevice
            proc.standardError = FileHandle.nullDevice
            try? proc.run()
        }

        // Multi-stage focus enforcement to prevent Spotify from popping forward
        let delays = [0.3, 0.7, 1.2, 1.8, 2.8, 4.0]
        for delay in delays {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                NSApp.activate(ignoringOtherApps: true)
                self?.window?.makeKeyAndOrderFront(nil)
            }
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        DispatchQueue.main.async {
            NSApp.activate(ignoringOtherApps: true)
            self.window?.makeKeyAndOrderFront(nil)
        }
    }

    func startBackendServerIfNeeded() {
        let fileManager = FileManager.default
        let bundleResourcePath = Bundle.main.resourcePath ?? ""
        let devProjectPath = "."
        let devPythonPath = "\(devProjectPath)/.venv/bin/python"

        // Determine working directory (prefer bundle resources if installed, else dev directory)
        var workingDir = devProjectPath
        if fileManager.fileExists(atPath: "\(bundleResourcePath)/backend/main.py") {
            workingDir = bundleResourcePath
        }

        // Determine python executable
        var pythonPath = "/usr/bin/python3"
        if fileManager.fileExists(atPath: "\(bundleResourcePath)/venv/bin/python") {
            pythonPath = "\(bundleResourcePath)/venv/bin/python"
        } else if fileManager.fileExists(atPath: devPythonPath) {
            pythonPath = devPythonPath
        } else if fileManager.fileExists(atPath: "/opt/homebrew/bin/python3") {
            pythonPath = "/opt/homebrew/bin/python3"
        } else if fileManager.fileExists(atPath: "/usr/local/bin/python3") {
            pythonPath = "/usr/local/bin/python3"
        }

        let proc = Process()
        proc.currentDirectoryURL = URL(fileURLWithPath: workingDir)
        proc.executableURL = URL(fileURLWithPath: pythonPath)
        proc.arguments = ["-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8888"]
        proc.standardOutput = FileHandle.nullDevice
        proc.standardError = FileHandle.nullDevice
        
        do {
            try proc.run()
            self.serverProcess = proc
        } catch {
            print("Backend launch error: \(error)")
        }
    }

    func loadAppURL(retries: Int = 30) {
        guard let statusURL = URL(string: "http://127.0.0.1:8888/api/status") else { return }
        let appURL = URL(string: "http://127.0.0.1:8888")!
        var request = URLRequest(url: appURL)
        request.cachePolicy = .reloadIgnoringLocalCacheData

        URLSession.shared.dataTask(with: statusURL) { [weak self] (_, response, _) in
            if let http = response as? HTTPURLResponse, http.statusCode == 200 {
                DispatchQueue.main.async {
                    self?.webView.load(request)
                    NSApp.activate(ignoringOtherApps: true)
                    self?.window?.makeKeyAndOrderFront(nil)
                }
            } else if retries > 0 {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                    self?.loadAppURL(retries: retries - 1)
                }
            } else {
                DispatchQueue.main.async {
                    self?.webView.load(request)
                    NSApp.activate(ignoringOtherApps: true)
                    self?.window?.makeKeyAndOrderFront(nil)
                }
            }
        }.resume()
    }

    func setupMenuBar() {
        let mainMenu = NSMenu()

        // App Menu
        let appMenuItem = NSMenuItem()
        mainMenu.addItem(appMenuItem)
        let appMenu = NSMenu()
        appMenuItem.submenu = appMenu

        appMenu.addItem(withTitle: "About Kiki's Spotify Mixer", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Hide Kiki's Spotify Mixer", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        let hideOthers = NSMenuItem(title: "Hide Others", action: #selector(NSApplication.hideOtherApplications(_:)), keyEquivalent: "h")
        hideOthers.keyEquivalentModifierMask = [.command, .option]
        appMenu.addItem(hideOthers)
        appMenu.addItem(withTitle: "Show All", action: #selector(NSApplication.unhideAllApplications(_:)), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Quit Kiki's Spotify Mixer", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")

        // Edit Menu
        let editMenuItem = NSMenuItem()
        mainMenu.addItem(editMenuItem)
        let editMenu = NSMenu(title: "Edit")
        editMenuItem.submenu = editMenu
        editMenu.addItem(withTitle: "Undo", action: #selector(UndoManager.undo), keyEquivalent: "z")
        editMenu.addItem(withTitle: "Redo", action: #selector(UndoManager.redo), keyEquivalent: "Z")
        editMenu.addItem(NSMenuItem.separator())
        editMenu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")

        // View Menu
        let viewMenuItem = NSMenuItem()
        mainMenu.addItem(viewMenuItem)
        let viewMenu = NSMenu(title: "View")
        viewMenuItem.submenu = viewMenu
        viewMenu.addItem(withTitle: "Reload App", action: #selector(reloadApp), keyEquivalent: "r")

        // Window Menu
        let windowMenuItem = NSMenuItem()
        mainMenu.addItem(windowMenuItem)
        let windowMenu = NSMenu(title: "Window")
        windowMenuItem.submenu = windowMenu
        windowMenu.addItem(withTitle: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        windowMenu.addItem(withTitle: "Zoom", action: #selector(NSWindow.performZoom(_:)), keyEquivalent: "")
        windowMenu.addItem(NSMenuItem.separator())
        windowMenu.addItem(withTitle: "Bring All to Front", action: #selector(NSApplication.arrangeInFront(_:)), keyEquivalent: "")

        NSApp.mainMenu = mainMenu
    }

    @objc func reloadApp() {
        loadAppURL()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }

    func applicationWillTerminate(_ notification: Notification) {
        serverProcess?.terminate()
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
