# 🔍 GITPEEK - GitHub Repository Analyzer CLI

A **command-line tool** to analyze GitHub repositories. It fetches repository statistics, identifies active contributors, analyzes file changes, and presents the data in a user-friendly format — with optional CSV exports and chart/graph generation.

---

## ✨ Features

* 📊 Fetch repository statistics (stars, forks, contributors)
* 👨‍💻 Identify the most active contributors
* 📝 Analyze the most changed files
* 🖥️ Terminal-based visualization with tables
* 📁 Export results to CSV
* 📈 Generate graphs for visual representation
* 💡 Interactive mode for ease of use

<p align="center">
  <img src="https://github.com/suejal/gitpeek/blob/main/images/gitpeekAnalysis.png?raw=true" alt="GitPeek Analysis Preview" width="600"/>
</p>

---

## ⚙️ Installation

### 🧾 Prerequisites

* Node.js 16+
* GitHub Personal Access Token
* For graphs: Node Canvas

### 📦 Setup

```bash
# Clone the repository
git clone https://github.com/suejal/gitpeek.git

# Navigate into the project folder
cd gitpeek

# Install dependencies
npm install
```

> 💡 To enable graph generation, ensure Node Canvas is installed correctly for your platform.

---

## 🧪 Command Line Usage

```bash
# Analyze a repository
npm start -- analyze -r owner/repo

# With a GitHub token
npm start -- analyze -r owner/repo -t yourGithubToken

# Export to CSV
npm start -- analyze -r owner/repo -c -o ./outputFolder

# Generate graphs
npm start -- analyze -r owner/repo -g -o ./outputFolder

# Full options
npm start -- analyze -r owner/repo -t your_token -c -g -o ./outputFolder
```

---

## 📋 Options

| Option         | Description                                        |
| -------------- | -------------------------------------------------- |
| `-r, --repo`   | GitHub repository in format `owner/repo`           |
| `-t, --token`  | GitHub personal access token                       |
| `-c, --csv`    | Export results to CSV                              |
| `-g, --graph`  | Generate graphs                                    |
| `-o, --output` | Output directory for exports (default: `./output`) |

<p align="center">
  <img src="https://github.com/suejal/gitpeek/blob/main/images/filesChart.png?raw=true" alt="Files Chart Preview" width="600"/>
</p>

---

## 🛠️ Requirements

* **Node.js 16+**
* For graph generation: **Node Canvas**

---

## 👨‍💻 Developed By

**Sujal Hota**
*A tool for developers who want deeper insights into GitHub repositories.*

---
