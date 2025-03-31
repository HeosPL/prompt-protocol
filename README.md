# Prompt Protocol

Prompt Protocol is a module for Cyberpunk RED in Foundry VTT that allows Game Masters (GMs) to create clickable skill test prompts directly in the chat. With this module, GMs can set a Difficulty Value (DV), add situational descriptions, and display a detailed breakdown of the roll result—including attributes, skill levels, modifiers, and critical roll details.

## Features

- **Easy GM Prompts:** Quickly create skill test prompts with selectable skills, DV, and situational descriptions.
- **Built-in Roll Integration:** Leverages the existing rolling system in Cyberpunk RED to perform tests without altering core functionality.
- **Detailed Breakdown:** Displays a collapsible report in the chat message showing:
  - The raw d10 roll (and additional dice for criticals, if any)
  - Attribute values and skill levels
  - Applied modifiers (base, additional, and situational)
  - Critical success or failure information
  - Final result of the test
- **Non-Invasive:** Integrates seamlessly with the Cyberpunk RED system using dynamic imports, leaving core code untouched.

## Installation

### Via Foundry VTT Module Manager

1. Open Foundry VTT and go to the Modules tab in your world configuration.
2. Click **"Install Module"** and paste the following manifest URL:
https://github.com/HeosPL/prompt-protocol/raw/main/module.json
3. Once installed, enable the module in your world settings.

### Manual Installation

1. Download the ZIP archive from:
https://github.com/HeosPL/prompt-protocol/archive/refs/heads/main.zip
2. Extract the archive and place the resulting folder in your Foundry VTT `modules` directory.
3. Enable the module in your world settings.

## Usage

### For Game Masters

- A new button labeled **"Run Skill Test"** will appear in the Scene Controls panel.
- Click the button to open the Prompt Protocol dialog.
- Select a skill from your character's available skills, set the DV, and add an optional situational description.
- Click **"Send to Chat"** to post a clickable skill test prompt in the chat.

### For Players

- When a player clicks on the prompt in the chat, the module will execute the corresponding skill test using the built-in Cyberpunk RED system.
- The result will be displayed in the chat, along with a collapsible detailed report showing dice rolls, modifiers, and any critical roll adjustments.

## Compatibility

- **System:** Cyberpunk RED - Core
- **Foundry VTT Version:** 11 or higher  
- Tested with the Cyberpunk RED Core system.

## Credits

- **Author:** Waldemar "Heos" Ładoń / ChatGPT
- Special thanks to the Cyberpunk RED community and the Foundry VTT developers.

## License
 * ----------------------------------------------------------------------------
 * “THE BEER-WARE LICENSE” 
 * can do whatever you want with this stuff. If we meet some day, and you think
 * this stuff is worth it, you can buy me a beer in return
 * ----------------------------------------------------------------------------
## Support

If you encounter any issues or have suggestions for improvements, please open an issue on the [GitHub repository](https://github.com/twoj-login/prompt-protocol).
