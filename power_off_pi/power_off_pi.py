def power_off_pi():
    """Power off the Raspberry Pi."""
    import os
    import subprocess

    script_path = os.path.join(os.path.dirname(__file__), 'power_off.sh')
    subprocess.run([script_path], check=True)


if __name__ == '__main__':
    power_off_pi()
