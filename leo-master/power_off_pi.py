#!/home/michael/leo-workspace/py/bin/python

def power_off_pi():
    """Power off the Raspberry Pi."""
    import subprocess

    subprocess.run(['sudo', 'shutdown', 'now'], check=True)


if __name__ == '__main__':
    power_off_pi()
