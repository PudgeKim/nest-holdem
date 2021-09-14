import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'app_user' })
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  username: string;

  @Column()
  password: string;

  @Column({ unique: true })
  nickname: string;

  @Column()
  money: number;
}
