from flask import Flask, request, jsonify, render_template, session
from flask_cors import CORS
from datetime import datetime, timedelta
import json
import uuid
import os
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from enum import Enum

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
CORS(app)

# ========== DATA MODELS ==========

class BotStatus(Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    ERROR = "error"

class MessageRole(Enum):
    USER = "user"
    ASSISTANT = "assistant"

@dataclass
class Bot:
    id: str
    name: str
    description: str
    provider: str
    status: BotStatus
    created_at: str
    last_active: str
    config: Dict[str, Any]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            **asdict(self),
            'status': self.status.value
        }

@dataclass
class Message:
    id: str
    bot_id: str
    role: MessageRole
    content: str
    timestamp: str
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            **asdict(self),
            'role': self.role.value
        }

@dataclass
class Analytics:
    total_bots: int
    active_bots: int
    total_messages: int
    avg_response_time: float

# ========== IN-MEMORY DATABASE ==========

bots_db: Dict[str, Bot] = {}
messages_db: Dict[str, List[Message]] = {}
analytics_db = Analytics(
    total_bots=0,
    active_bots=0,
    total_messages=0,
    avg_response_time=1.5
)

# ========== HELPER FUNCTIONS ==========

def generate_id() -> str:
    """Generate a unique ID."""
    return str(uuid.uuid4())

def get_current_timestamp() -> str:
    """Get current timestamp in ISO format."""
    return datetime.now().isoformat()

def validate_bot_data(data: Dict[str, Any]) -> tuple[bool, str]:
    """Validate bot creation/update data."""
    required_fields = ['name', 'description', 'provider']
    
    for field in required_fields:
        if field not in data or not data[field].strip():
            return False, f"Missing or empty field: {field}"
    
    if len(data['name']) > 100:
        return False, "Name too long (max 100 characters)"
    
    if len(data['description']) > 500:
        return False, "Description too long (max 500 characters)"
    
    return True, ""

def get_bot_stats(bot_id: str) -> Dict[str, Any]:
    """Get statistics for a specific bot."""
    messages = messages_db.get(bot_id, [])
    user_messages = [m for m in messages if m.role == MessageRole.USER]
    assistant_messages = [m for m in messages if m.role == MessageRole.ASSISTANT]
    
    return {
        'total_messages': len(messages),
        'user_messages': len(user_messages),
        'assistant_messages': len(assistant_messages),
        'last_message': messages[-1].timestamp if messages else None
    }

# ========== INITIAL SAMPLE DATA ==========

def initialize_sample_data():
    """Initialize the database with sample data."""
    sample_bots = [
        Bot(
            id="bot_001",
            name="Customer Support Bot",
            description="Handles customer inquiries and support tickets",
            provider="OpenAI",
            status=BotStatus.ACTIVE,
            created_at="2024-01-15T10:30:00",
            last_active="2024-03-20T14:45:00",
            config={"model": "gpt-4", "temperature": 0.7, "max_tokens": 1000}
        ),
        Bot(
            id="bot_002",
            name="Sales Assistant",
            description="Helps with sales inquiries and product recommendations",
            provider="Anthropic",
            status=BotStatus.ACTIVE,
            created_at="2024-02-01T09:15:00",
            last_active="2024-03-20T13:20:00",
            config={"model": "claude-3", "temperature": 0.8, "max_tokens": 800}
        ),
        Bot(
            id="bot_003",
            name="Content Generator",
            description="Creates marketing content and blog posts",
            provider="OpenAI",
            status=BotStatus.INACTIVE,
            created_at="2024-01-20T11:45:00",
            last_active="2024-03-18T16:30:00",
            config={"model": "gpt-3.5-turbo", "temperature": 0.9, "max_tokens": 1500}
        )
    ]
    
    for bot in sample_bots:
        bots_db[bot.id] = bot
    
    # Sample messages for bot_001
    messages_db["bot_001"] = [
        Message(
            id="msg_001",
            bot_id="bot_001",
            role=MessageRole.USER,
            content="Hello, I need help with my order.",
            timestamp="2024-03-20T14:30:00"
        ),
        Message(
            id="msg_002",
            bot_id="bot_001",
            role=MessageRole.ASSISTANT,
            content="I'd be happy to help with your order. Could you please provide your order number?",
            timestamp="2024-03-20T14:31:00"
        ),
        Message(
            id="msg_003",
            bot_id="bot_001",
            role=MessageRole.USER,
            content="My order number is ORD-789123.",
            timestamp="2024-03-20T14:32:00"
        )
    ]
    
    # Update analytics
    analytics_db.total_bots = len(bots_db)
    analytics_db.active_bots = len([b for b in bots_db.values() if b.status == BotStatus.ACTIVE])
    analytics_db.total_messages = sum(len(msgs) for msgs in messages_db.values())

# ========== ROUTE HANDLERS ==========

@app.route('/')
def index():
    """Serve the main application page."""
    return render_template('index.html')

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'timestamp': get_current_timestamp(),
        'version': '2.0.0'
    })

@app.route('/api/bots', methods=['GET'])
def get_bots():
    """Get all bots."""
    search_query = request.args.get('search', '').lower()
    
    if search_query:
        filtered_bots = [
            bot.to_dict() for bot in bots_db.values()
            if search_query in bot.name.lower() or search_query in bot.description.lower()
        ]
    else:
        filtered_bots = [bot.to_dict() for bot in bots_db.values()]
    
    return jsonify({
        'bots': filtered_bots,
        'count': len(filtered_bots),
        'total': len(bots_db)
    })

@app.route('/api/bots/<bot_id>', methods=['GET'])
def get_bot(bot_id: str):
    """Get a specific bot by ID."""
    bot = bots_db.get(bot_id)
    if not bot:
        return jsonify({'error': 'Bot not found'}), 404
    
    bot_data = bot.to_dict()
    bot_data['stats'] = get_bot_stats(bot_id)
    
    return jsonify(bot_data)

@app.route('/api/bots', methods=['POST'])
def create_bot():
    """Create a new bot."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        is_valid, error_message = validate_bot_data(data)
        if not is_valid:
            return jsonify({'error': error_message}), 400
        
        bot_id = generate_id()
        new_bot = Bot(
            id=bot_id,
            name=data['name'].strip(),
            description=data['description'].strip(),
            provider=data['provider'].strip(),
            status=BotStatus.INACTIVE,
            created_at=get_current_timestamp(),
            last_active=get_current_timestamp(),
            config=data.get('config', {})
        )
        
        bots_db[bot_id] = new_bot
        messages_db[bot_id] = []
        
        # Update analytics
        analytics_db.total_bots += 1
        
        return jsonify(new_bot.to_dict()), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/bots/<bot_id>', methods=['PUT'])
def update_bot(bot_id: str):
    """Update an existing bot."""
    bot = bots_db.get(bot_id)
    if not bot:
        return jsonify({'error': 'Bot not found'}), 404
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Update allowed fields
        if 'name' in data and data['name'].strip():
            bot.name = data['name'].strip()
        
        if 'description' in data and data['description'].strip():
            bot.description = data['description'].strip()
        
        if 'provider' in data and data['provider'].strip():
            bot.provider = data['provider'].strip()
        
        if 'config' in data and isinstance(data['config'], dict):
            bot.config.update(data['config'])
        
        if 'status' in data:
            try:
                bot.status = BotStatus(data['status'])
                # Update active bots count in analytics
                if bot.status == BotStatus.ACTIVE:
                    analytics_db.active_bots = len([b for b in bots_db.values() if b.status == BotStatus.ACTIVE])
            except ValueError:
                return jsonify({'error': 'Invalid status value'}), 400
        
        bot.last_active = get_current_timestamp()
        
        return jsonify(bot.to_dict())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/bots/<bot_id>', methods=['DELETE'])
def delete_bot(bot_id: str):
    """Delete a bot."""
    bot = bots_db.get(bot_id)
    if not bot:
        return jsonify({'error': 'Bot not found'}), 404
    
    # Update analytics
    analytics_db.total_bots -= 1
    if bot.status == BotStatus.ACTIVE:
        analytics_db.active_bots -= 1
    
    # Remove bot and its messages
    del bots_db[bot_id]
    if bot_id in messages_db:
        analytics_db.total_messages -= len(messages_db[bot_id])
        del messages_db[bot_id]
    
    return jsonify({'message': 'Bot deleted successfully'})

@app.route('/api/bots/<bot_id>/messages', methods=['GET'])
def get_messages(bot_id: str):
    """Get all messages for a specific bot."""
    if bot_id not in bots_db:
        return jsonify({'error': 'Bot not found'}), 404
    
    messages = messages_db.get(bot_id, [])
    return jsonify({
        'messages': [msg.to_dict() for msg in messages],
        'count': len(messages)
    })

@app.route('/api/bots/<bot_id>/messages', methods=['POST'])
def send_message(bot_id: str):
    """Send a message to a bot and get response."""
    bot = bots_db.get(bot_id)
    if not bot:
        return jsonify({'error': 'Bot not found'}), 404
    
    if bot.status != BotStatus.ACTIVE:
        return jsonify({'error': 'Bot is not active'}), 400
    
    try:
        data = request.get_json()
        if not data or 'content' not in data or not data['content'].strip():
            return jsonify({'error': 'Message content is required'}), 400
        
        user_message = Message(
            id=generate_id(),
            bot_id=bot_id,
            role=MessageRole.USER,
            content=data['content'].strip(),
            timestamp=get_current_timestamp()
        )
        
        # Add user message to history
        if bot_id not in messages_db:
            messages_db[bot_id] = []
        messages_db[bot_id].append(user_message)
        
        # Simulate AI response
        response_content = f"I received your message: '{user_message.content}'. This is a simulated response from {bot.name}."
        
        assistant_message = Message(
            id=generate_id(),
            bot_id=bot_id,
            role=MessageRole.ASSISTANT,
            content=response_content,
            timestamp=get_current_timestamp()
        )
        
        messages_db[bot_id].append(assistant_message)
        
        # Update analytics
        analytics_db.total_messages += 2
        bot.last_active = get_current_timestamp()
        
        return jsonify({
            'user_message': user_message.to_dict(),
            'assistant_message': assistant_message.to_dict(),
            'bot_status': bot.status.value
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/bots/<bot_id>/messages', methods=['DELETE'])
def clear_messages(bot_id: str):
    """Clear all messages for a bot."""
    if bot_id not in bots