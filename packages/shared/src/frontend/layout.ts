export function layout(title: string, content: string, agencySlug?: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${title}</title>
            <script src="https://unpkg.com/htmx.org@2"></script>
            <script src="https://unpkg.com/htmx-ext-json-enc@2.0.1/json-enc.js"></script>
        </head>
        <body>
            ${agencySlug ? `
            <header>
                <nav>
                    <ul>
                        <li>
                            <a href="/${agencySlug}">sign in</a>
                            <a href="/${agencySlug}/signup">sign up</a>
                        </li>
                    </ul>
                </nav>
            </header>
            ` : ''}
            ${content}
        </body>
    </html>
`;
}
