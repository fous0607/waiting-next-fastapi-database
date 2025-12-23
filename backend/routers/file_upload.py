"""
파일 업로드 API
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from typing import List
import uuid
import os
from pathlib import Path

from database import get_db
from models import User, NoticeAttachment
from auth import require_system_admin

router = APIRouter()

# 파일 업로드 설정
UPLOAD_DIR = Path("uploads/notices")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# 파일 크기 제한 (bytes) - 10MB 기본값
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

# 허용 파일 타입
ALLOWED_EXTENSIONS = {
    # 이미지
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    # 문서
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    # 압축
    'application/zip',
    'application/x-zip-compressed',
    # 텍스트
    'text/plain',
}


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db)
):
    """파일 업로드 (임시)
    
    공지사항 작성 시 파일을 먼저 업로드하고,
    공지사항 저장 시 attachment_ids를 함께 전송
    """
    
    # 파일 타입 검증
    if file.content_type not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"허용되지 않는 파일 형식입니다. 허용 형식: 이미지, PDF, 문서, 압축 파일"
        )
    
    # 파일 읽기
    contents = await file.read()
    file_size = len(contents)
    
    # 파일 크기 검증
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"파일 크기가 너무 큽니다. 최대 {MAX_FILE_SIZE // (1024 * 1024)}MB까지 업로드 가능합니다."
        )
    
    # UUID 기반 파일명 생성
    file_extension = Path(file.filename).suffix
    stored_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = UPLOAD_DIR / stored_filename
    
    # 파일 저장
    with open(file_path, "wb") as f:
        f.write(contents)
    
    # 임시 첨부파일 레코드 생성 (notice_id는 나중에 업데이트)
    attachment = NoticeAttachment(
        notice_id=0,  # 임시값, 공지사항 생성 시 업데이트
        filename=file.filename,
        stored_filename=stored_filename,
        file_size=file_size,
        file_type=file.content_type
    )
    
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    
    return {
        "id": attachment.id,
        "filename": attachment.filename,
        "file_size": attachment.file_size,
        "file_type": attachment.file_type
    }


@router.delete("/upload/{attachment_id}")
async def delete_upload(
    attachment_id: int,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db)
):
    """업로드된 파일 삭제"""
    
    attachment = db.query(NoticeAttachment).filter(
        NoticeAttachment.id == attachment_id
    ).first()
    
    if not attachment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="첨부파일을 찾을 수 없습니다"
        )
    
    # 파일 삭제
    file_path = UPLOAD_DIR / attachment.stored_filename
    if file_path.exists():
        file_path.unlink()
    
    # DB 레코드 삭제
    db.delete(attachment)
    db.commit()
    
    return {"message": "파일이 삭제되었습니다"}


@router.get("/download/{attachment_id}")
async def download_file(
    attachment_id: int,
    db: Session = Depends(get_db)
):
    """첨부파일 다운로드"""
    from fastapi.responses import FileResponse
    
    attachment = db.query(NoticeAttachment).filter(
        NoticeAttachment.id == attachment_id
    ).first()
    
    if not attachment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="첨부파일을 찾을 수 없습니다"
        )
    
    file_path = UPLOAD_DIR / attachment.stored_filename
    
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="파일을 찾을 수 없습니다"
        )
    
    return FileResponse(
        path=file_path,
        filename=attachment.filename,
        media_type=attachment.file_type
    )
