import re

def parse_env(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Store both the order/comments and the key-value pairs
    lines = content.split('\n')
    env_vars = {}
    for line in lines:
        match = re.match(r'^([^#=]+)=(.*)$', line)
        if match:
            key, val = match.groups()
            env_vars[key.strip()] = val.strip()
    return env_vars, lines

local_vars, local_lines = parse_env('.env')
remote_vars, remote_lines = parse_env('.env.remote')

# Keys we want to sync from local to remote
sync_keys = [
    'WEBHOOK_URL', 'WEBHOOK_SECRET',
    'NEXT_PUBLIC_API_BASE_URL', 'INTERNAL_API_BASE_URL', 'WEB_APP_BASE_URL',
    'AUTH_CODE_TTL_MINUTES', 'AUTH_CODE_LENGTH', 'AUTH_CODE_SECRET',
    'WECHAT_PAY_ORDER_EXPIRE_MINUTES',
    'ALIYUN_SMS_ENDPOINT', 'ALIYUN_SMS_ACCESS_KEY_ID', 'ALIYUN_SMS_ACCESS_KEY_SECRET',
    'ALIYUN_SMS_SIGN_NAME', 'ALIYUN_SMS_TEMPLATE_CODE', 'ALIYUN_SMS_TEMPLATE_PARAM_NAME',
    'OSS_REGION', 'OSS_ENDPOINT', 'OSS_BUCKET', 'OSS_ACCESS_KEY_ID', 'OSS_ACCESS_KEY_SECRET',
    'OSS_STS_ROLE_ARN', 'OSS_STS_ENDPOINT', 'OSS_UPLOAD_EXPIRE_SECONDS', 'OSS_SIGN_EXPIRE_SECONDS',
    'OSS_CUSTOM_DOMAIN',
    'WECHAT_PAY_APP_ID', 'WECHAT_PAY_APP_SECRET',
    'WECHAT_PAY_MCH_ID', 'WECHAT_PAY_MCH_CERT_SERIAL_NO', 'WECHAT_PAY_PUBLIC_KEY_ID',
    'WECHAT_PAY_API_V3_KEY', 'WECHAT_PAY_PRIVATE_KEY_PATH', 'WECHAT_PAY_MCH_CERT_PATH',
    'WECHAT_PAY_PUBLIC_KEY_PATH', 'WECHAT_PAY_NOTIFY_URL', 'WECHAT_PAY_REFUND_NOTIFY_URL',
    'WECHAT_PAY_CALLBACK_BASE_URL'
]

# Create a new remote content
new_remote_vars = remote_vars.copy()
for key in sync_keys:
    if key in local_vars:
        new_remote_vars[key] = local_vars[key]

# Write back preserving remote structure where possible, appending missing ones
output_lines = []
seen_keys = set()
for line in remote_lines:
    match = re.match(r'^([^#=]+)=(.*)$', line)
    if match:
        key = match.group(1).strip()
        if key in new_remote_vars:
            output_lines.append(f"{key}={new_remote_vars[key]}")
            seen_keys.add(key)
        else:
            output_lines.append(line)
    else:
        output_lines.append(line)

# Append any sync keys that weren't in remote
for key in sync_keys:
    if key in local_vars and key not in seen_keys:
        output_lines.append(f"{key}={local_vars[key]}")

with open('.env.remote.new', 'w', encoding='utf-8') as f:
    f.write('\n'.join(output_lines) + '\n')

print("Merged successfully.")
