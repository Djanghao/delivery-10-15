import requests
from PIL import Image
from io import BytesIO

# Base URL
BASE_URL = "https://tzxm.zjzwfw.gov.cn"

# Create session to maintain cookies
session = requests.Session()

# Set headers
headers = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
    "Origin": BASE_URL,
    "DNT": "1",
}

# Parameters
sendid = "1e266cbbb119481d9fa865bd6d2fd419"
pUid = "df5fd0e798534f6ebb7453b462a0d6d2"
flag = "1"

# Referer
referer = f"{BASE_URL}/tzxmweb/zwtpages/resultsPublicity/notice_of_publicity_content_new.html?pUid={pUid}&sendid={sendid}"

def download_pdf_with_captcha(sendid, flag, captcha_code):
    """
    Download PDF with manual captcha input

    Args:
        sendid: Project send ID
        flag: Download flag
        captcha_code: User input captcha code
    """

    # Step 1: Initialize captcha session
    print("Step 1: Initializing captcha session...")
    response = session.post(
        f"{BASE_URL}/publicannouncement.do?method=publicCheckContentRondom",
        headers={**headers, "Referer": referer, "X-Requested-With": "XMLHttpRequest"}
    )
    print(f"Session initialized. Status: {response.status_code}")
    print(f"Cookies: {session.cookies.get_dict()}")

    # Step 2: Get captcha image
    print("\nStep 2: Fetching captcha image...")
    import random
    captcha_response = session.get(
        f"{BASE_URL}/publicannouncement.do?method=publicCheckContent&t={random.random()}",
        headers={
            **headers,
            "Referer": referer,
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
        }
    )

    # Save captcha image
    img = Image.open(BytesIO(captcha_response.content))
    img.save("captcha.png")
    print("Captcha saved as captcha.png")

    # Step 3: Verify captcha
    print(f"\nStep 3: Verifying captcha with code: {captcha_code}")
    verify_response = session.post(
        f"{BASE_URL}/publicannouncement.do?method=CheckRandom",
        data={"Txtidcode": captcha_code},
        headers={
            **headers,
            "Referer": referer,
            "X-Requested-With": "XMLHttpRequest",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Accept": "application/json, text/javascript, */*; q=0.01"
        }
    )

    print(f"Verification response: {verify_response.text}")
    result = verify_response.json()

    if result and result[0].get("random_flag") == "1":
        print("✓ Captcha verified successfully!")

        # Step 4: Download PDF
        print("\nStep 4: Downloading PDF...")
        download_url = f"{BASE_URL}/publicannouncement.do?method=downFile&sendid={sendid}&flag={flag}&Txtidcode={captcha_code}"
        print(f"Download URL: {download_url}")

        pdf_response = session.get(
            download_url,
            headers={**headers, "Referer": referer}
        )

        if pdf_response.status_code == 200:
            filename = "downloaded.pdf"
            with open(filename, "wb") as f:
                f.write(pdf_response.content)
            print(f"✓ PDF downloaded successfully as {filename}")
            print(f"File size: {len(pdf_response.content)} bytes")
            return True
        else:
            print(f"✗ Download failed. Status: {pdf_response.status_code}")
            return False
    else:
        print("✗ Captcha verification failed!")
        return False

if __name__ == "__main__":
    print("=== PDF Download with Captcha ===\n")

    # Step 1: Initialize captcha session
    print("Step 1: Initializing captcha session...")
    response = session.post(
        f"{BASE_URL}/publicannouncement.do?method=publicCheckContentRondom",
        headers={**headers, "Referer": referer, "X-Requested-With": "XMLHttpRequest"}
    )
    print(f"Session initialized. Status: {response.status_code}")
    print(f"Cookies: {session.cookies.get_dict()}")

    # Step 2: Get captcha image
    print("\nStep 2: Fetching captcha image...")
    import random
    captcha_response = session.get(
        f"{BASE_URL}/publicannouncement.do?method=publicCheckContent&t={random.random()}",
        headers={
            **headers,
            "Referer": referer,
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
        }
    )

    # Save captcha image
    img = Image.open(BytesIO(captcha_response.content))
    img.save("captcha.png")
    print("Captcha saved as captcha.png")

    # Wait for user to input captcha
    print("\nPlease check captcha.png and enter the captcha code:")
    captcha_input = input("Captcha code: ").strip()

    if not captcha_input:
        print("No captcha code provided. Exiting.")
        exit(1)

    # Step 3: Verify captcha
    print(f"\nStep 3: Verifying captcha with code: {captcha_input}")
    verify_response = session.post(
        f"{BASE_URL}/publicannouncement.do?method=CheckRandom",
        data={"Txtidcode": captcha_input},
        headers={
            **headers,
            "Referer": referer,
            "X-Requested-With": "XMLHttpRequest",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Accept": "application/json, text/javascript, */*; q=0.01"
        }
    )

    print(f"Verification response: {verify_response.text}")
    result = verify_response.json()

    if result and result[0].get("random_flag") == "1":
        print("✓ Captcha verified successfully!")

        # Step 4: Download PDF
        print("\nStep 4: Downloading PDF...")
        download_url = f"{BASE_URL}/publicannouncement.do?method=downFile&sendid={sendid}&flag={flag}&Txtidcode={captcha_input}"
        print(f"Download URL: {download_url}")

        pdf_response = session.get(
            download_url,
            headers={**headers, "Referer": referer}
        )

        if pdf_response.status_code == 200:
            # Extract filename from Content-Disposition header
            filename = "downloaded.pdf"
            content_disposition = pdf_response.headers.get("Content-Disposition", "")
            if content_disposition:
                import re
                from urllib.parse import unquote
                # Try to extract filename from Content-Disposition
                match = re.search(r'filename[^;=\n]*=(([\'"]).*?\2|[^;\n]*)', content_disposition)
                if match:
                    filename = match.group(1).strip('\'"')
                    # Decode if URL encoded
                    filename = unquote(filename, encoding='utf-8')

            print(f"Content-Disposition: {content_disposition}")
            print(f"Filename: {filename}")

            with open(filename, "wb") as f:
                f.write(pdf_response.content)
            print(f"✓ PDF downloaded successfully as {filename}")
            print(f"File size: {len(pdf_response.content)} bytes")
        else:
            print(f"✗ Download failed. Status: {pdf_response.status_code}")
    else:
        print("✗ Captcha verification failed!")