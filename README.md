# Laraset

Automated Laravel project setup with Docker and SQLite database configuration.

## Installation

```bash
npm install -g @fiandev/laraset
```

## Usage

```bash
laraset --url <git-repository-url>
```

### Example

```bash
laraset --url https://github.com/laravel/laravel.git
```

## Features

- 🐳 Automatically detects PHP version from `composer.json`
- 📦 Downloads and installs Composer dependencies
- 🔧 Configures SQLite database by default
- 🔑 Generates Laravel application key
- 🗄️ Runs database migrations
- 🧹 Cleans up temporary files

## Requirements

- Node.js >= 18.0.0
- Docker installed and running
- Git

## What it does

1. **Clones** the Laravel repository
2. **Detects** PHP version from `composer.json`
3. **Downloads** Composer.phar to the project
4. **Installs** dependencies with `composer install`
5. **Copies** `.env.example` to `.env` if needed
6. **Configures** SQLite database settings
7. **Generates** application key
8. **Runs** database migrations
9. **Cleans up** temporary files

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev

# Test the CLI
npm start -- --url https://github.com/laravel/laravel.git
```

## License

MIT
