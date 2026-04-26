"""Image generation connection testing and generation service.

Supports:
- Volcengine (豆包) text-to-image API
- Baidu Qianfan (百度千帆) text-to-image API
- Generic OpenAI-compatible image generation APIs (DALL-E style)
"""

from __future__ import annotations

import uuid
from pathlib import Path

import httpx
import structlog

from app.storage.base import get_data_dir

log = structlog.get_logger()

# Timeout for test requests (seconds)
_TEST_TIMEOUT = 15.0
# Timeout for generation requests (seconds) — longer because image gen takes time
_GEN_TIMEOUT = 120.0


async def test_connection(connection_data: dict) -> dict:
    """Test an image generation connection.

    Returns:
        {"success": bool, "message": str}
    """
    api_key = connection_data.get("api_key", "")
    api_base_url = connection_data.get("api_base_url", "").rstrip("/")
    model_name = connection_data.get("model_name", "")

    if not api_key:
        return {"success": False, "message": "API Key 不能为空"}
    if not api_base_url:
        return {"success": False, "message": "API Base URL 不能为空"}

    # Detect provider based on api_base_url patterns
    if "volcengine" in api_base_url or "volces" in api_base_url:
        return await _test_volcengine(api_key, api_base_url, model_name)
    elif "qianfan" in api_base_url or "baidubce" in api_base_url:
        return await _test_qianfan(api_key, api_base_url, model_name)
    else:
        # Generic OpenAI-compatible image generation test (e.g. DALL-E style)
        return await _test_generic(api_key, api_base_url, model_name)


async def _test_volcengine(api_key: str, api_base_url: str, model_name: str) -> dict:
    """Test Volcengine (豆包) text-to-image API.

    Volcengine uses a request/response pattern:
    POST to create a task, then poll for result.
    For testing, we only verify the API key by sending a minimal request
    and checking the response status.
    """
    try:
        async with httpx.AsyncClient(timeout=_TEST_TIMEOUT) as client:
            # Try to list models or send a minimal text2img request
            # The typical endpoint: POST /api/v1/images/generations
            url = f"{api_base_url}/api/v1/images/generations"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": model_name or "doubao-seedream-3-0-t2i-250415",
                "prompt": "test",
                "size": "1024x1024",
                "n": 1,
            }
            resp = await client.post(url, json=payload, headers=headers)

            if resp.status_code == 200 or resp.status_code == 201:
                return {"success": True, "message": "豆包 API 连接成功"}
            elif resp.status_code == 401 or resp.status_code == 403:
                return {"success": False, "message": f"认证失败 (HTTP {resp.status_code})，请检查 API Key"}
            elif resp.status_code == 400:
                # Bad request might still mean the key is valid
                error_detail = ""
                try:
                    body = resp.json()
                    error_detail = body.get("error", {}).get("message", "") or body.get("message", "")
                except Exception:
                    error_detail = resp.text[:200]
                # If the error is about the prompt or model, auth is OK
                if "model" in error_detail.lower() or "prompt" in error_detail.lower() or "param" in error_detail.lower():
                    return {"success": True, "message": "豆包 API 认证成功（模型参数需调整）"}
                return {"success": False, "message": f"请求参数错误: {error_detail[:100]}"}
            else:
                error_msg = ""
                try:
                    body = resp.json()
                    error_msg = body.get("error", {}).get("message", "") or body.get("message", "")
                except Exception:
                    error_msg = resp.text[:200]
                return {"success": False, "message": f"HTTP {resp.status_code}: {error_msg[:100]}"}

    except httpx.TimeoutException:
        return {"success": False, "message": "连接超时，请检查 API Base URL"}
    except httpx.ConnectError:
        return {"success": False, "message": "无法连接服务器，请检查 API Base URL"}
    except Exception as e:
        log.error("volcengine_test_error", error=str(e))
        return {"success": False, "message": f"测试异常: {str(e)[:100]}"}


async def _test_qianfan(api_key: str, api_base_url: str, model_name: str) -> dict:
    """Test Baidu Qianfan (百度千帆) text-to-image API.

    Qianfan uses Bearer token authentication.
    The typical endpoint follows OpenAI-compatible format on Qianfan.
    """
    try:
        async with httpx.AsyncClient(timeout=_TEST_TIMEOUT) as client:
            # Qianfan OpenAI-compatible endpoint
            url = f"{api_base_url}/images/generations"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": model_name or "stable-diffusion-xl",
                "prompt": "test",
                "size": "1024x1024",
                "n": 1,
            }
            resp = await client.post(url, json=payload, headers=headers)

            if resp.status_code == 200 or resp.status_code == 201:
                return {"success": True, "message": "百度千帆 API 连接成功"}
            elif resp.status_code == 401 or resp.status_code == 403:
                return {"success": False, "message": f"认证失败 (HTTP {resp.status_code})，请检查 API Key"}
            elif resp.status_code == 400:
                error_detail = ""
                try:
                    body = resp.json()
                    error_detail = body.get("error", {}).get("message", "") or body.get("message", "")
                except Exception:
                    error_detail = resp.text[:200]
                if "model" in error_detail.lower() or "param" in error_detail.lower():
                    return {"success": True, "message": "百度千帆 API 认证成功（模型参数需调整）"}
                return {"success": False, "message": f"请求参数错误: {error_detail[:100]}"}
            else:
                error_msg = ""
                try:
                    body = resp.json()
                    error_msg = body.get("error", {}).get("message", "") or body.get("message", "")
                except Exception:
                    error_msg = resp.text[:200]
                return {"success": False, "message": f"HTTP {resp.status_code}: {error_msg[:100]}"}

    except httpx.TimeoutException:
        return {"success": False, "message": "连接超时，请检查 API Base URL"}
    except httpx.ConnectError:
        return {"success": False, "message": "无法连接服务器，请检查 API Base URL"}
    except Exception as e:
        log.error("qianfan_test_error", error=str(e))
        return {"success": False, "message": f"测试异常: {str(e)[:100]}"}


async def _test_generic(api_key: str, api_base_url: str, model_name: str) -> dict:
    """Test a generic OpenAI-compatible image generation API."""
    try:
        async with httpx.AsyncClient(timeout=_TEST_TIMEOUT) as client:
            url = f"{api_base_url}/images/generations"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": model_name or "dall-e-3",
                "prompt": "test",
                "size": "1024x1024",
                "n": 1,
            }
            resp = await client.post(url, json=payload, headers=headers)

            if resp.status_code == 200 or resp.status_code == 201:
                return {"success": True, "message": "API 连接成功"}
            elif resp.status_code == 401 or resp.status_code == 403:
                return {"success": False, "message": f"认证失败 (HTTP {resp.status_code})"}
            elif resp.status_code == 400:
                error_detail = ""
                try:
                    body = resp.json()
                    error_detail = body.get("error", {}).get("message", "") or body.get("message", "")
                except Exception:
                    error_detail = resp.text[:200]
                if "model" in error_detail.lower() or "param" in error_detail.lower():
                    return {"success": True, "message": "API 认证成功（模型参数需调整）"}
                return {"success": False, "message": f"请求参数错误: {error_detail[:100]}"}
            else:
                error_msg = ""
                try:
                    body = resp.json()
                    error_msg = body.get("error", {}).get("message", "") or body.get("message", "")
                except Exception:
                    error_msg = resp.text[:200]
                return {"success": False, "message": f"HTTP {resp.status_code}: {error_msg[:100]}"}

    except httpx.TimeoutException:
        return {"success": False, "message": "连接超时，请检查 API Base URL"}
    except httpx.ConnectError:
        return {"success": False, "message": "无法连接服务器，请检查 API Base URL"}
    except Exception as e:
        log.error("generic_image_test_error", error=str(e))
        return {"success": False, "message": f"测试异常: {str(e)[:100]}"}


# ---------------------------------------------------------------------------
# Image Generation (actual generation, not just testing)
# ---------------------------------------------------------------------------


async def generate_image(
    connection_data: dict,
    prompt: str,
    size: str = "1024x1024",
    n: int = 1,
) -> dict:
    """Generate an image using the specified connection.

    Returns:
        {"success": bool, "message": str, "url": str | None}
        url is the local path to the saved image (e.g. /api/images/xxx.png)
    """
    api_key = connection_data.get("api_key", "")
    api_base_url = connection_data.get("api_base_url", "").rstrip("/")
    model_name = connection_data.get("model_name", "")
    image_gen_config = connection_data.get("image_gen_config") or {}

    if not api_key:
        return {"success": False, "message": "API Key 不能为空", "url": None}
    if not api_base_url:
        return {"success": False, "message": "API Base URL 不能为空", "url": None}

    effective_size = size or image_gen_config.get("image_size", "1024x1024")
    effective_n = n or image_gen_config.get("n", 1)

    # Detect provider
    if "volcengine" in api_base_url or "volces" in api_base_url:
        return await _generate_volcengine(api_key, api_base_url, model_name, prompt, effective_size, effective_n)
    elif "qianfan" in api_base_url or "baidubce" in api_base_url:
        return await _generate_qianfan(api_key, api_base_url, model_name, prompt, effective_size, effective_n)
    else:
        return await _generate_generic(api_key, api_base_url, model_name, prompt, effective_size, effective_n)


def _save_image_from_bytes(content: bytes, ext: str = ".png") -> str:
    """Save image bytes to the images directory, return the URL path."""
    images_dir = get_data_dir() / "images"
    images_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4()}{ext}"
    (images_dir / filename).write_bytes(content)
    return f"/api/images/{filename}"


async def _download_image(url: str) -> bytes | None:
    """Download an image from a URL."""
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                return resp.content
    except Exception as e:
        log.error("image_download_error", url=url, error=str(e))
    return None


async def _generate_volcengine(
    api_key: str, api_base_url: str, model_name: str,
    prompt: str, size: str, n: int,
) -> dict:
    """Generate image via Volcengine (豆包) API.

    Volcengine follows OpenAI-compatible format for image generation.
    """
    try:
        async with httpx.AsyncClient(timeout=_GEN_TIMEOUT) as client:
            url = f"{api_base_url}/api/v1/images/generations"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": model_name or "doubao-seedream-3-0-t2i-250415",
                "prompt": prompt,
                "size": size,
                "n": n,
            }
            resp = await client.post(url, json=payload, headers=headers)

            if resp.status_code not in (200, 201):
                error_msg = _extract_error(resp)
                return {"success": False, "message": f"生成失败: {error_msg[:150]}", "url": None}

            body = resp.json()
            images = body.get("data", [])
            if not images:
                return {"success": False, "message": "API 未返回图片数据", "url": None}

            # Take the first image
            image_data = images[0]
            image_url = image_data.get("url") or image_data.get("b64_json")

            if image_url and image_url.startswith("http"):
                content = await _download_image(image_url)
                if content is None:
                    return {"success": False, "message": "下载生成的图片失败", "url": None}
                local_url = _save_image_from_bytes(content)
                return {"success": True, "message": "图片生成成功", "url": local_url}
            elif image_url:
                # b64_json — decode and save
                import base64
                content = base64.b64decode(image_url)
                local_url = _save_image_from_bytes(content)
                return {"success": True, "message": "图片生成成功", "url": local_url}
            else:
                return {"success": False, "message": "API 未返回图片URL", "url": None}

    except httpx.TimeoutException:
        return {"success": False, "message": "生成超时，请稍后重试", "url": None}
    except Exception as e:
        log.error("volcengine_generate_error", error=str(e))
        return {"success": False, "message": f"生成异常: {str(e)[:100]}", "url": None}


async def _generate_qianfan(
    api_key: str, api_base_url: str, model_name: str,
    prompt: str, size: str, n: int,
) -> dict:
    """Generate image via Baidu Qianfan (百度千帆) API."""
    try:
        async with httpx.AsyncClient(timeout=_GEN_TIMEOUT) as client:
            url = f"{api_base_url}/images/generations"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": model_name or "stable-diffusion-xl",
                "prompt": prompt,
                "size": size,
                "n": n,
            }
            resp = await client.post(url, json=payload, headers=headers)

            if resp.status_code not in (200, 201):
                error_msg = _extract_error(resp)
                return {"success": False, "message": f"生成失败: {error_msg[:150]}", "url": None}

            body = resp.json()
            images = body.get("data", [])
            if not images:
                return {"success": False, "message": "API 未返回图片数据", "url": None}

            image_data = images[0]
            image_url = image_data.get("url") or image_data.get("b64_json")

            if image_url and image_url.startswith("http"):
                content = await _download_image(image_url)
                if content is None:
                    return {"success": False, "message": "下载生成的图片失败", "url": None}
                local_url = _save_image_from_bytes(content)
                return {"success": True, "message": "图片生成成功", "url": local_url}
            elif image_url:
                import base64
                content = base64.b64decode(image_url)
                local_url = _save_image_from_bytes(content)
                return {"success": True, "message": "图片生成成功", "url": local_url}
            else:
                return {"success": False, "message": "API 未返回图片URL", "url": None}

    except httpx.TimeoutException:
        return {"success": False, "message": "生成超时，请稍后重试", "url": None}
    except Exception as e:
        log.error("qianfan_generate_error", error=str(e))
        return {"success": False, "message": f"生成异常: {str(e)[:100]}", "url": None}


async def _generate_generic(
    api_key: str, api_base_url: str, model_name: str,
    prompt: str, size: str, n: int,
) -> dict:
    """Generate image via generic OpenAI-compatible API (DALL-E style)."""
    try:
        async with httpx.AsyncClient(timeout=_GEN_TIMEOUT) as client:
            url = f"{api_base_url}/images/generations"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": model_name or "dall-e-3",
                "prompt": prompt,
                "size": size,
                "n": n,
            }
            resp = await client.post(url, json=payload, headers=headers)

            if resp.status_code not in (200, 201):
                error_msg = _extract_error(resp)
                return {"success": False, "message": f"生成失败: {error_msg[:150]}", "url": None}

            body = resp.json()
            images = body.get("data", [])
            if not images:
                return {"success": False, "message": "API 未返回图片数据", "url": None}

            image_data = images[0]
            image_url = image_data.get("url") or image_data.get("b64_json")

            if image_url and image_url.startswith("http"):
                content = await _download_image(image_url)
                if content is None:
                    return {"success": False, "message": "下载生成的图片失败", "url": None}
                local_url = _save_image_from_bytes(content)
                return {"success": True, "message": "图片生成成功", "url": local_url}
            elif image_url:
                import base64
                content = base64.b64decode(image_url)
                local_url = _save_image_from_bytes(content)
                return {"success": True, "message": "图片生成成功", "url": local_url}
            else:
                return {"success": False, "message": "API 未返回图片URL", "url": None}

    except httpx.TimeoutException:
        return {"success": False, "message": "生成超时，请稍后重试", "url": None}
    except Exception as e:
        log.error("generic_image_generate_error", error=str(e))
        return {"success": False, "message": f"生成异常: {str(e)[:100]}", "url": None}


def _extract_error(resp: httpx.Response) -> str:
    """Extract error message from an API response."""
    try:
        body = resp.json()
        return body.get("error", {}).get("message", "") or body.get("message", "")
    except Exception:
        return resp.text[:200]
