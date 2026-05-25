import json
import os
import sys
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional

BASE = 'https://www.offer360.cn/api/proxy'
SITE_BASE = 'https://www.offer360.cn'
PHONE = os.environ.get('DEBUG_PHONE', '13988683002')
PASSWORD = os.environ.get('DEBUG_PASSWORD', 'Debug@123456')
DEVICE_ID = os.environ.get('DEBUG_DEVICE_ID', 'device-debug-campus-jobs-500')
SESSION_ID = os.environ.get('DEBUG_SESSION_ID', 'session-debug-campus-jobs-500')
PAGE_LIMIT = int(os.environ.get('DEBUG_PAGE_LIMIT', '20'))
PAGE_NUMBER = int(os.environ.get('DEBUG_PAGE_NUMBER', '1'))
LIST_TARGET = os.environ.get('DEBUG_LIST_TARGET', 'both')


def req(path: str, method: str = 'GET', data=None, token: Optional[str] = None):
    headers = {
        'Content-Type': 'application/json',
        'x-device-id': DEVICE_ID,
        'x-session-id': SESSION_ID,
    }
    if token:
        headers['Authorization'] = f'Bearer {token}'

    body = None if data is None else json.dumps(data).encode()
    request = urllib.request.Request(f'{BASE}{path}', data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            text = response.read().decode() or '{}'
            return response.status, json.loads(text)
    except urllib.error.HTTPError as error:
        text = error.read().decode()
        try:
            payload = json.loads(text)
        except Exception:
            payload = {'raw': text}
        return error.code, payload


def req_site(path: str):
    headers = {
        'x-device-id': DEVICE_ID,
        'x-session-id': SESSION_ID,
    }
    request = urllib.request.Request(f'{SITE_BASE}{path}', headers=headers, method='GET')
    opener = urllib.request.build_opener(NoRedirectHandler())
    try:
        with opener.open(request, timeout=30) as response:
            text = response.read().decode() or ''
            return response.status, text
    except urllib.error.HTTPError as error:
        text = error.read().decode()
        return error.code, text


class NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def main():
    status, payload = req('/auth/login', 'POST', {'phone': PHONE, 'password': PASSWORD})
    print('login', status)
    print(json.dumps(payload, ensure_ascii=False))

    token = (payload.get('data') or payload).get('token')
    if not token:
        raise SystemExit('no token')

    targets = []
    if LIST_TARGET in ('all', 'both'):
        targets.append(('all', f'/jobs?page={PAGE_NUMBER}&limit={PAGE_LIMIT}'))
    if LIST_TARGET in ('free', 'both'):
        targets.append(('free', '/jobs/free-zone'))
    if LIST_TARGET in ('recommended', 'both'):
        targets.append(('recommended', f'/jobs/recommended?page={PAGE_NUMBER}&limit={PAGE_LIMIT}'))

    for list_name, path in targets:
        status, payload = req(path, 'GET', token=token)
        jobs = ((payload.get('data') or payload).get('list', []))
        print(f'\nlist {list_name} {status} count={len(jobs)}')
        failures: List[Dict[str, Any]] = []
        for job in jobs[:20]:
            job_id = job['id']
            if job.get('hasAnnouncement'):
                if list_name == 'free':
                    endpoint = f'/jobs/{job_id}/free-zone/view-announcement'
                else:
                    endpoint = f'/jobs/{job_id}/view-announcement'
                code, result = req(endpoint, 'POST', {}, token=token)
                if code >= 500:
                    failures.append({'action': 'view-announcement', 'jobId': job_id, 'status': code, 'response': result})
                else:
                    redirect_path = (result.get('data') or result).get('redirectPath')
                    if redirect_path:
                        redirect_code, redirect_text = req_site(redirect_path)
                        if redirect_code >= 500:
                            failures.append({'action': 'announcement-redirect', 'jobId': job_id, 'status': redirect_code, 'response': redirect_text[:500]})
            if job.get('hasDelivery'):
                if list_name == 'free':
                    endpoint = f'/jobs/{job_id}/free-zone/deliver'
                else:
                    endpoint = f'/jobs/{job_id}/deliver'
                code, result = req(endpoint, 'POST', {}, token=token)
                if code >= 500:
                    failures.append({'action': 'deliver', 'jobId': job_id, 'status': code, 'response': result})
                else:
                    redirect_path = (result.get('data') or result).get('redirectPath')
                    if redirect_path:
                        redirect_code, redirect_text = req_site(redirect_path)
                        if redirect_code >= 500:
                            failures.append({'action': 'delivery-redirect', 'jobId': job_id, 'status': redirect_code, 'response': redirect_text[:500]})
        print(json.dumps(failures, ensure_ascii=False))


if __name__ == '__main__':
    if len(sys.argv) > 1:
        PAGE_LIMIT = int(sys.argv[1])
    if len(sys.argv) > 2:
        PAGE_NUMBER = int(sys.argv[2])
    main()
