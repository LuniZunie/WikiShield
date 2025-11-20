# WikiShield

See [the Wikipedia page](https://en.wikipedia.org/wiki/Wikipedia:WikiShield) for information. The [docs](https://lunizunie.github.io/WikiShield/) are also available on Github Pages.

Target project structure:

```txt
/config
> /config/metadata.js - __script__ object (version, changelog, pages)
> /config/defaults.js - default settings
> /config/languages.js - subdomain/language mappings

/data
> /data/warnings.js - warning templates and colors
> /data/namespaces.js - namespace configurations
> /data/sounds.js - sound definitions and base64 data
> /data/events.js - wikishieldEventData (conditions, events)
> /data/welcome-templates.js - welcome message templates

/ui
> /ui/styles.css - all CSS styles (currently embedded in wikishieldData)
> /ui/templates.js - HTML templates (queue, settings, interface markup)
> /ui/interface.js - WikiShieldInterface class
> /ui/settings.js - WikiShieldSettingsInterface class
> /ui/progress-bar.js - WikiShieldProgressBar class

/core
> /core/wikishield.js - main WikiShield class
> /core/api.js - WikiShieldAPI class
> /core/queue.js - WikiShieldQueue class
> /core/event-manager.js - WikiShieldEventManager class

/ai
> /ai/prompts.js - BuildAIAnalysisPrompt function and prompt templates
> /ai/ollama.js - WikiShieldOllamaAI class

/utils
> /utils/formatting.js - fullTrim and text utility functions
> /utils/logger.js - WikiShieldLog class
> /utils/helpers.js - WikiShieldUtil class

/index.js - main entry point that imports and initializes everything
```
