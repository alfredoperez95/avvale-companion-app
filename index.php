<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hello World · Avvale</title>
    <link rel="preconnect" href="https://www.avvale.com">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            color: #e8e8e8;
            padding: 2rem;
        }
        .card {
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 3rem;
            text-align: center;
            max-width: 420px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
        }
        .logo {
            width: 100%;
            max-width: 220px;
            height: auto;
            margin-bottom: 2rem;
            display: block;
            margin-left: auto;
            margin-right: auto;
        }
        h1 {
            font-size: 1.75rem;
            font-weight: 600;
            margin-bottom: 0.5rem;
            letter-spacing: -0.02em;
        }
        .tagline {
            font-size: 0.95rem;
            color: rgba(255, 255, 255, 0.6);
        }
    </style>
</head>
<body>
    <div class="card">
        <img
            src="https://www.avvale.com/hubfs/avvale-logo-hor-col-neg-1.png"
            alt="Avvale"
            class="logo"
        />
        <h1>Hello World</h1>
        <p class="tagline">Avvale Companion App</p>
    </div>
</body>
</html>
