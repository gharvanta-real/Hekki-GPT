import ssl
import socket

hostname = 'gn.cambridgeschool.edu.in'
port = 443

try:
    context = ssl.create_default_context()
    with socket.create_connection((hostname, port), timeout=10) as sock:
        with context.wrap_socket(sock, server_hostname=hostname) as ssock:
            cert = ssock.getpeercert(binary_form=True)
            print(f"Fingerprint: {cert.hex()}")
except Exception as e:
    print(f"Error: {e}")
