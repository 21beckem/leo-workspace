# Leo Workspace

Yay Leo!

## Setup

1. Install [VScode](https://code.visualstudio.com/)
2. Install [Remote - SSH Extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-ssh)
3. Follow [Connection](#connection) instructions to get access to the terminal
4. Do the following to give power_off.sh sudo access to turn off the pi:
    - Run this in the terminal: `sudo visudo`
    - That will open a file editor. Add this line to the very bottom:
        - **Note**: It must be an absolute path. No `~/...` or `./...`
        ```bash
        michael ALL=(ALL) NOPASSWD: /home/michael/leo-workspace/power_off_pi/power_off.sh
        ```
5. Install needed pip libs:
```bash
pip3 install aiohttp adafruit-circuitpython-pca9685 adafruit-blinka
pip3 install adafruit-circuitpython-ads1x15 --break-system-packages
```

## Connection

1. Run the command below to open VScode in the remote editor

```bash
code --remote ssh-remote+michael@192.168.0.163 /home/michael/leo-workspace
```

2. Run this in the terminal to activate the venv:

```bash
source ./py/bin/activate
```

3. Develop!

